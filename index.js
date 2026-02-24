require('dotenv').config(); // Install: npm install dotenv

const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason,
    BufferJSON,
    proto
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs').promises;
const fssync = require('fs');
const cors = require('cors');
const helmet = require('helmet'); // npm install helmet
const rateLimit = require('express-rate-limit'); // npm install express-rate-limit
const { z } = require('zod'); // npm install zod (for validation)

// ==================== CONFIG VALIDATION ====================
const envSchema = z.object({
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    MONGODB_URI: z.string().min(10),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
    BAILEYS_VERSION: z.string().default('2.3000.1033105955'),
}).refine(data => data.MONGODB_URI.includes('mongodb'), {
    message: "MONGODB_URI must be a valid MongoDB connection string"
});

const env = envSchema.parse(process.env);

// ==================== APP INIT ====================
const handler = require('./handler');
const app = express();
const PORT = parseInt(env.PORT, 10);
const logger = pino({ 
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

// ==================== SECURITY MIDDLEWARE ====================
app.use(helmet({
    contentSecurityPolicy: false, // Disable if serving inline scripts
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: process.env.FRONTEND_URL?.split(',') || true,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'PUT']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
    max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
    message: { success: false, error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/pair', limiter);
app.use('/deploy', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// ==================== DATABASE ====================
const mongoOptions = {
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 10000,
};

mongoose.connection.on('error', err => logger.error('MongoDB error:', err));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

async function connectDB() {
    try {
        await mongoose.connect(env.MONGODB_URI, mongoOptions);
        logger.info('🟢 MongoDB connected');
    } catch (err) {
        logger.error('❌ MongoDB connection failed:', err.message);
        setTimeout(connectDB, 5000); // Reconnect attempt
    }
}

// ==================== SCHEMAS ====================
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true, trim: true },
    phoneNumber: { type: String, required: true, index: true, trim: true },
    creds: { type: Object, required: true },
    status: { type: String, default: 'active', enum: ['active', 'paused', 'logged_out'], index: true },
    settings: { type: Object, default: {} },
    addedAt: { type: Date, default: Date.now, index: true },
    lastSeen: { type: Date, default: Date.now }
});
const Session = mongoose.model('UserSession', sessionSchema);

const authKeySchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    keyId: { type: String, required: true },
    data: { type: Object },
    updatedAt: { type: Date, default: Date.now }
});
authKeySchema.index({ sessionId: 1, keyId: 1 }, { unique: true, expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 day TTL for orphaned keys
const AuthKey = mongoose.model('AuthKey', authKeySchema);

// ==================== MONGO AUTH STATE ====================
const useMongoAuthState = async (sessionId) => {
    const writeData = async (data, keyId) => {
        try {
            await AuthKey.updateOne(
                { sessionId, keyId },
                { $set: { 
                    data: JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
                    updatedAt: new Date()
                }},
                { upsert: true }
            );
        } catch (e) { logger.error('AuthKey Save Error:', e); }
    };

    const readData = async (keyId) => {
        try {
            const res = await AuthKey.findOne({ sessionId, keyId }).lean();
            return res ? JSON.parse(JSON.stringify(res.data), BufferJSON.reviver) : null;
        } catch (e) { 
            logger.debug('AuthKey Read Error:', e.message);
            return null; 
        }
    };

    const removeData = async (keyId) => {
        try { await AuthKey.deleteOne({ sessionId, keyId }); } catch (e) {}
    };

    const sessionRecord = await Session.findOne({ sessionId }).lean();
    if (!sessionRecord) throw new Error("Session not found in DB");

    let creds = JSON.parse(JSON.stringify(sessionRecord.creds), BufferJSON.reviver);

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const ops = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const keyId = `${category}-${id}`;
                            if (value) {
                                ops.push(writeData(value, keyId));
                            } else {
                                ops.push(removeData(keyId));
                            }
                        }
                    }
                    await Promise.all(ops);
                }
            }
        },
        saveCreds: async () => {
            try {
                await Session.updateOne(
                    { sessionId },
                    { 
                        $set: { 
                            creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
                            lastSeen: new Date()
                        } 
                    }
                );
            } catch (e) { logger.error('Creds save failed:', e); }
        }
    };
};

// ==================== UTILITIES ====================
function fancy(text) {
    const map = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
    return text.split('').map(c => map[c.toLowerCase()] || c).join('');
}

function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

// ==================== PAIRING ENGINE ====================
let pairingSocket = null;
let pairingQueue = [];
let isPairingActive = false;

async function processPairingQueue() {
    if (isPairingActive || pairingQueue.length === 0) return;
    isPairingActive = true;
    
    const { phoneNumber, resolve, reject } = pairingQueue.shift();
    
    try {
        if (!pairingSocket) throw new Error('Pairing engine not ready');
        const code = await pairingSocket.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
        resolve({ success: true, code });
    } catch (err) {
        logger.error('Pairing error:', err);
        reject({ success: false, error: 'Pairing failed. Please retry.' });
    } finally {
        isPairingActive = false;
        setTimeout(processPairingQueue, 1000); // Small delay between pairings
    }
}

async function startPairingEngine() {
    const tempDir = './pairing_temp';
    
    // Cleanup old temp files
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
    await fs.mkdir(tempDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(tempDir);

    const [version] = await fetchLatestBaileysVersion();
    const versionParts = env.BAILEYS_VERSION.split('.').map(Number);

    const conn = makeWASocket({
        version: versionParts.length === 3 ? versionParts : version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5
    });

    pairingSocket = conn;

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Optional: emit QR via WebSocket for frontend display
            logger.debug('QR code updated');
        }

        if (connection === 'open') {
            const userJid = conn.user?.id?.split(':')[0];
            if (!userJid) return;
            
            const sessionId = randomMegaId();
            logger.info(fancy(`✨ Linking successful for ${userJid}. Saving to DB...`));

            try {
                await Session.findOneAndUpdate(
                    { phoneNumber: userJid },
                    { 
                        sessionId, 
                        phoneNumber: userJid, 
                        creds: JSON.parse(JSON.stringify(state.creds, BufferJSON.replacer)), 
                        status: 'active',
                        lastSeen: new Date()
                    },
                    { upsert: true, new: true }
                );

                const welcomeMsg = `╭─── • 🥀 • ───╮\n   INSIDIOUS BOT\n╰─── • 🥀 • ───╯\n\n✅ *Pairing Successful!*\n\n🆔 *SESSION ID:* \`${sessionId}\`\n\nCopy this ID then go to the website to start your bot now.`;
                
                await conn.sendMessage(userJid + '@s.whatsapp.net', { 
                    image: { url: "https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg" },
                    caption: welcomeMsg
                });
                await conn.sendMessage(userJid + '@s.whatsapp.net', { text: sessionId });

            } catch (err) {
                logger.error('Failed to save session:', err);
            }

            // Graceful cleanup without logout
            setTimeout(() => {
                try {
                    conn.ev.removeAllListeners();
                    conn.ws?.close();
                } catch (e) {}
                fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
                logger.info(fancy("🔒 Pairing station closed. Creds secured in MongoDB."));
            }, 5000);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldRestart = code !== DisconnectReason.loggedOut && 
                                 code !== DisconnectReason.badSession &&
                                 connection !== 'open';
            
            if (shouldRestart) {
                logger.warn('Pairing connection closed, restarting...');
                setTimeout(startPairingEngine, 2000);
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);
}

// ==================== BOT MANAGER ====================
const activeBots = new Map();

async function activateBot(sessionId, number) {
    // Cleanup existing instance
    if (activeBots.has(sessionId)) {
        try { 
            const existing = activeBots.get(sessionId);
            existing.ev?.removeAllListeners();
            existing.ws?.close();
        } catch (e) {}
        activeBots.delete(sessionId);
    }

    try {
        const { state, saveCreds } = await useMongoAuthState(sessionId);
        const [version] = await fetchLatestBaileysVersion();
        const versionParts = env.BAILEYS_VERSION.split('.').map(Number);

        const conn = makeWASocket({
            version: versionParts.length === 3 ? versionParts : version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            logger: pino({ level: env.LOG_LEVEL }),
            browser: Browsers.ubuntu("Chrome"),
            syncFullHistory: false,
            markOnlineOnConnect: true,
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 5,
            connectTimeoutMs: 60000
        });

        activeBots.set(sessionId, conn);

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                await Session.updateOne({ sessionId }, { 
                    $set: { status: 'active', lastSeen: new Date() } 
                });
                logger.info(`🚀 [BOT ONLINE] ID: ${sessionId} | Number: ${number}`);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
                    logger.warn(`🔐 Session ${sessionId} logged out. Cleaning up...`);
                    await Session.deleteOne({ sessionId });
                    await AuthKey.deleteMany({ sessionId });
                    activeBots.delete(sessionId);
                } else if (statusCode !== undefined) {
                    logger.warn(`⚠️ Bot ${sessionId} disconnected (code: ${statusCode}). Reconnecting in 5s...`);
                    setTimeout(() => activateBot(sessionId, number), 5000);
                }
            }
        });

        conn.ev.on('messages.upsert', async (m) => {
            try { 
                await handler(conn, m); 
            } catch (e) { 
                logger.error('Handler error:', e); 
            }
        });

        conn.ev.on('connection.close', () => {
            activeBots.delete(sessionId);
        });

        return { success: true };
    } catch (e) {
        logger.error('Bot activation failed:', e);
        return { success: false, error: e.message };
    }
}

async function loadActiveBots() {
    try {
        const active = await Session.find({ status: 'active' }).limit(50); // Prevent overload
        logger.info(`🔄 Restoring ${active.length} active bots...`);
        
        for (const [index, sess] of active.entries()) {
            // Stagger startup to avoid DB/rate limit spikes
            await new Promise(r => setTimeout(r, index * 2000)); 
            activateBot(sess.sessionId, sess.phoneNumber).catch(err => 
                logger.error(`Failed to restore ${sess.sessionId}:`, err)
            );
        }
    } catch (e) {
        logger.error('Failed to load active bots:', e);
    }
}

// ==================== API ENDPOINTS ====================

// Health check with detailed status
app.get('/health', async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const botCount = activeBots.size;
    
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        database: dbStatus,
        activeBots: botCount,
        timestamp: new Date().toISOString()
    });
});

// Readiness probe for Railway/K8s
app.get('/ready', async (req, res) => {
    const isReady = mongoose.connection.readyState === 1 && pairingSocket !== null;
    if (isReady) {
        res.status(200).json({ ready: true });
    } else {
        res.status(503).json({ ready: false, reason: 'Database or pairing engine not ready' });
    }
});

app.get('/pair', async (req, res) => {
    const { num } = req.query;
    
    // Validation
    const validation = z.string().regex(/^\+?[0-9]{7,15}$/).safeParse(num);
    if (!validation.success) {
        return res.status(400).json({ success: false, error: "Valid phone number required (with country code)" });
    }
    
    if (!pairingSocket) {
        return res.status(503).json({ success: false, error: "Pairing engine initializing. Please wait 10 seconds." });
    }

    // Queue the request
    return new Promise((resolve) => {
        pairingQueue.push({ 
            phoneNumber: num, 
            resolve: (result) => res.json(result),
            reject: (error) => res.status(500).json(error)
        });
        processPairingQueue();
    });
});

app.post('/deploy', async (req, res) => {
    const { sessionId, number } = req.body;
    
    // Validation
    const validation = z.object({
        sessionId: z.string().min(5).max(20),
        number: z.string().regex(/^\+?[0-9]{7,15}$/)
    }).safeParse({ sessionId, number });
    
    if (!validation.success) {
        return res.status(400).json({ success: false, error: "Valid sessionId and phone number required" });
    }
    
    // Check if session exists
    const session = await Session.findOne({ sessionId });
    if (!session) {
        return res.status(404).json({ success: false, error: "Session not found" });
    }
    
    const result = await activateBot(sessionId, number);
    res.json(result);
});

app.get('/sessions', async (req, res) => {
    try {
        const { limit = 50, status } = req.query;
        const query = status ? { status } : {};
        
        const data = await Session.find(query, { creds: 0 })
            .sort({ addedAt: -1 })
            .limit(parseInt(limit));
            
        res.json({ success: true, sessions: data, count: data.length });
    } catch (e) { 
        logger.error('Sessions fetch error:', e);
        res.status(500).json({ success: false, error: "Failed to fetch sessions" }); 
    }
});

app.delete('/sessions/:id', async (req, res) => {
    try {
        const sid = req.params.id;
        
        // Cleanup bot instance
        if (activeBots.has(sid)) {
            const bot = activeBots.get(sid);
            bot.ev?.removeAllListeners();
            bot.ws?.close();
            activeBots.delete(sid);
        }
        
        // Cleanup database
        await Promise.all([
            Session.deleteOne({ sessionId: sid }),
            AuthKey.deleteMany({ sessionId: sid })
        ]);
        
        logger.info(`🗑️ Session ${sid} deleted`);
        res.json({ success: true });
    } catch (e) { 
        logger.error('Delete session error:', e);
        res.status(500).json({ success: false, error: "Deletion failed" }); 
    }
});

app.post('/settings', async (req, res) => {
    try {
        const { sessionId, settings } = req.body;
        
        if (!sessionId || !settings) {
            return res.status(400).json({ success: false, error: "sessionId and settings required" });
        }
        
        const result = await Session.updateOne(
            { sessionId },
            { $set: { settings, lastSeen: new Date() } }
        );
        
        if (result.modifiedCount === 0 && result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        
        // If bot is active, you could emit a settings update event here
        logger.info(`⚙️ Settings updated for session ${sessionId}`);
        res.json({ success: true });
    } catch (e) {
        logger.error('Settings save error:', e);
        res.status(500).json({ success: false, error: "Failed to save settings" });
    }
});

// Fallback for SPA routing if needed
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'index.html');
    if (fssync.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    
    // Don't leak error details in production
    const message = env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
        
    res.status(err.status || 500).json({
        success: false,
        error: message
    });
});

// ==================== GRACEFUL SHUTDOWN ====================
async function gracefulShutdown(signal) {
    logger.warn(`⚠️ Received ${signal}. Starting graceful shutdown...`);
    
    // Close HTTP server
    server?.close(async () => {
        logger.info('🔌 HTTP server closed');
        
        // Close all active bot connections
        for (const [sessionId, bot] of activeBots) {
            try {
                bot.ev?.removeAllListeners();
                bot.ws?.close();
                await Session.updateOne({ sessionId }, { $set: { status: 'paused' } });
                logger.info(`⏸️ Bot ${sessionId} paused`);
            } catch (e) {}
        }
        activeBots.clear();
        
        // Close DB connection
        await mongoose.disconnect();
        logger.info('🔌 MongoDB disconnected');
        
        // Cleanup temp files
        try { await fs.rm('./pairing_temp', { recursive: true, force: true }); } catch {}
        
        logger.info('✅ Shutdown complete');
        process.exit(0);
    });
    
    // Force exit after timeout
    setTimeout(() => {
        logger.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});

// ==================== START SERVER ====================
let server;

async function start() {
    await connectDB();
    
    // Start pairing engine
    startPairingEngine().catch(err => logger.error('Failed to start pairing engine:', err));
    
    // Restore active bots
    await loadActiveBots();
    
    // Start HTTP server
    server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(fancy("🟢 INSIDIOUS STATION LIVE"));
        logger.info(`🚀 Server running on port ${PORT} (${env.NODE_ENV})`);
    });
    
    // Handle server errors
    server.on('error', (err) => {
        logger.error('Server error:', err);
    });
}

// Start application
start().catch(err => {
    logger.error('Failed to start application:', err);
    process.exit(1);
});

module.exports = app;

