require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const mongoose = require('mongoose');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason,
    proto
} = require("@whiskeysockets/baileys");
const qrcode = require('qrcode-terminal');

// === IMPORTS ===
const config = require('./config');
const handler = require('./handler');
const { 
    getSessionAuthState, 
    deleteSession, 
    listSessions, 
    sessionExists,
    getSessionMeta,
    saveSessionMeta,
    SESSIONS_DIR 
} = require('./utils/sessionManager');

// === EXPRESS SETUP ===
const app = express();
const PORT = process.env.PORT || config.port || 3000;
const HOST = process.env.HOST || config.host || '0.0.0.0';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// === LOGGING SETUP ===
const logger = pino({ 
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

// === GLOBAL STATE ===
const connections = new Map(); // Map<sessionId, {conn, user, meta}>
const pairingQueue = new Map(); // Map<phoneNumber, {resolve, reject, timeout}>
let botStartTime = Date.now();
let isMongoConnected = false;

// === FANCY TEXT FUNCTION ===
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    const map = {
        a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
        j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
        s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
        A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
        J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
        S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
    };
    return text.split('').map(c => map[c] || c).join('');
}

// === MONGODB CONNECTION ===
async function connectMongoDB() {
    if (!config.useMongoDB && process.env.USE_MONGODB !== 'true') {
        logger.info(fancy('📁 Using file-based sessions'));
        return;
    }
    
    try {
        logger.info(fancy('🔗 Connecting to MongoDB...'));
        await mongoose.connect(config.mongodbUri, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
        });
        isMongoConnected = true;
        logger.info(fancy('✅ MongoDB Connected'));
    } catch (err) {
        logger.error(fancy('❌ MongoDB Connection FAILED: ' + err.message));
        logger.info(fancy('💡 Falling back to file-based sessions'));
    }
}

// === START BOT FOR SPECIFIC USER ===
async function startUserBot(phoneNumber, deviceInfo = {}) {
    const sessionId = phoneNumber.replace(/[^0-9]/g, '');
    logger.info(fancy(`🔐 Starting session for: ${sessionId}`));
    
    try {
        // Get auth state (file or mongo)
        const { state, saveCreds } = isMongoConnected 
            ? await require('./utils/mongoAuth').useMongoAuthState(sessionId)
            : await getSessionAuthState(sessionId);
            
        const { version } = await fetchLatestBaileysVersion();

        // Create Baileys connection
        const conn = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true
        });

        // Store connection
        connections.set(sessionId, {
            conn,
            user: null,
            meta: {
                phoneNumber: sessionId,
                device: deviceInfo.browser || 'Unknown',
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                status: 'connecting'
            }
        });

        // Save initial metadata
        if (isMongoConnected) {
            await require('./utils/mongoAuth').updateSessionMeta(sessionId, connections.get(sessionId).meta);
        } else {
            await saveSessionMeta(sessionId, connections.get(sessionId).meta);
        }

        // === CONNECTION EVENTS ===
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // QR Code for manual pairing (fallback)
            if (qr) {
                logger.info(fancy(`📱 QR ready for ${sessionId}`));
                qrcode.generate(qr, { small: true });
            }
            
            // Connected
            if (connection === 'open') {
                logger.info(fancy(`✅ ${sessionId} connected`));
                
                const session = connections.get(sessionId);
                if (session) {
                    session.user = conn.user;
                    session.meta.status = 'active';
                    session.meta.lastActive = new Date().toISOString();
                    
                    // Update metadata
                    if (isMongoConnected) {
                        await require('./utils/mongoAuth').updateSessionMeta(sessionId, session.meta);
                    } else {
                        await saveSessionMeta(sessionId, session.meta);
                    }
                }

                // Send welcome to user
                try {
                    const welcomeMsg = fancy(
                        `╭━━━ • 🥀 • ━━━╮\n` +
                        `   ✅ Connected!\n` +
                        `╰━━━ • 🥀 • ━━━╯\n\n` +
                        `🤖 ${config.botName}\n` +
                        `📞 ${conn.user?.id?.split(':')[0]}\n` +
                        `🔐 ID: ${handler.getBotId?.() || 'Unknown'}\n` +
                        `⚡ Status: ACTIVE\n\n` +
                        `👑 Dev: ${config.developer}\n` +
                        `🔗 ${config.newsletterLink}`
                    );
                    
                    await conn.sendMessage(`${sessionId}@s.whatsapp.net`, {
                        text: welcomeMsg,
                        contextInfo: {
                            isForwarded: true,
                            forwardingScore: 999,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.newsletterJid,
                                newsletterName: config.botName
                            }
                        }
                    });
                } catch (e) {
                    logger.warn(`Welcome message failed: ${e.message}`);
                }

                // Initialize handler for this session
                if (handler?.init) {
                    try {
                        await handler.init(conn, sessionId);
                        logger.info(fancy(`✅ Handler initialized for ${sessionId}`));
                    } catch (e) {
                        logger.error(`Handler init error: ${e.message}`);
                    }
                }
            }
            
            // Disconnected
            if (connection === 'close') {
                logger.info(fancy(`🔌 ${sessionId} disconnected`));
                
                const session = connections.get(sessionId);
                if (session) {
                    session.meta.status = 'disconnected';
                    session.meta.lastActive = new Date().toISOString();
                }
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    logger.info(fancy(`🔄 Reconnecting ${sessionId} in 5s...`));
                    setTimeout(() => {
                        if (connections.has(sessionId)) {
                            startUserBot(sessionId, session?.meta);
                        }
                    }, 5000);
                } else {
                    // Logged out - clean up
                    connections.delete(sessionId);
                    if (isMongoConnected) {
                        await require('./utils/mongoAuth').deleteMongoSession(sessionId);
                    } else {
                        deleteSession(sessionId);
                    }
                    logger.info(fancy(`🗑️ Session ${sessionId} cleaned up`));
                }
            }
        });

        // Credentials update
        conn.ev.on('creds.update', saveCreds);

        // Messages
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m, sessionId);
                }
            } catch (error) {
                logger.error(`Message handler error: ${error.message}`);
            }
        });

        // Group updates
        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler?.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update, sessionId);
                }
            } catch (error) {
                logger.error(`Group update error: ${error.message}`);
            }
        });

        // Calls
        conn.ev.on('call', async (call) => {
            try {
                if (handler?.handleCall) {
                    await handler.handleCall(conn, call, sessionId);
                }
            } catch (error) {
                logger.error(`Call handler error: ${error.message}`);
            }
        });

        return conn;

    } catch (error) {
        logger.error(fancy(`❌ Error starting bot for ${sessionId}: ${error.message}`));
        connections.delete(sessionId);
        throw error;
    }
}

// === REQUEST PAIRING CODE ===
async function requestPairingCode(phoneNumber) {
    const sessionId = phoneNumber.replace(/[^0-9]/g, '');
    
    // Check if already connected
    if (connections.has(sessionId) && connections.get(sessionId).user) {
        return { success: true, message: 'Already connected', sessionId };
    }
    
    // Start or get existing connection
    let conn;
    if (!connections.has(sessionId)) {
        conn = await startUserBot(sessionId);
    } else {
        conn = connections.get(sessionId).conn;
    }
    
    // Request code with timeout
    const code = await Promise.race([
        conn.requestPairingCode(sessionId),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout - no response from WhatsApp')), 30000)
        )
    ]);
    
    return { success: true, code, sessionId };
}

// === EXPRESS ROUTES ===

// Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health Check
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    res.json({
        status: 'healthy',
        uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`,
        connections: connections.size,
        database: isMongoConnected ? 'mongodb' : 'file',
        timestamp: new Date().toISOString()
    });
});

// Bot Info
app.get('/botinfo', (req, res) => {
    const sessions = [];
    for (const [id, data] of connections) {
        sessions.push({
            sessionId: id,
            phoneNumber: data.meta?.phoneNumber,
            status: data.meta?.status,
            connected: !!data.user,
            botName: data.user?.name,
            botJid: data.user?.id,
            createdAt: data.meta?.createdAt,
            lastActive: data.meta?.lastActive
        });
    }
    
    res.json({
        success: true,
        botName: config.botName,
        version: config.version || '2.1.1',
        developer: config.developer,
        mode: config.mode,
        sessions: sessions,
        totalSessions: sessions.length,
        uptime: Date.now() - botStartTime
    });
});

// List Sessions
app.get('/sessions', (req, res) => {
    const sessions = [];
    
    // From active connections
    for (const [id, data] of connections) {
        sessions.push({
            sessionId: id,
            phoneNumber: data.meta?.phoneNumber,
            status: data.meta?.status,
            connected: !!data.user,
            createdAt: data.meta?.createdAt,
            lastActive: data.meta?.lastActive
        });
    }
    
    // From stored sessions (file-based)
    if (!isMongoConnected) {
        const stored = listSessions();
        stored.forEach(sid => {
            if (!sessions.find(s => s.sessionId === sid)) {
                const meta = getSessionMeta(sid) || {};
                sessions.push({
                    sessionId: sid,
                    phoneNumber: meta.phoneNumber || sid,
                    status: meta.status || 'stored',
                    connected: false,
                    createdAt: meta.createdAt,
                    lastActive: meta.lastActive
                });
            }
        });
    }
    
    res.json({ success: true, sessions, count: sessions.length });
});

// Pair Endpoint
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.status(400).json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.status(400).json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }
        
        logger.info(fancy(`🔑 Generating code for: ${cleanNum}`));
        
        const result = await requestPairingCode(cleanNum);
        
        // Register with handler
        if (result.success && handler?.pairNumber) {
            await handler.pairNumber(cleanNum, { browser: req.headers['user-agent'] });
        }
        
        res.json(result);
        
    } catch (err) {
        logger.error(`Pairing error: ${err.message}`);
        
        if (err.message.includes("already paired")) {
            res.json({ success: true, message: "Number already paired" });
        } else if (err.message.includes("Timeout")) {
            res.status(408).json({ success: false, error: "Timeout. Please try again." });
        } else {
            res.status(500).json({ success: false, error: "Failed: " + err.message });
        }
    }
});

// Unpair/Delete Session
app.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const sessionId = req.params.sessionId.replace(/[^0-9]/g, '');
        
        // Close connection if active
        if (connections.has(sessionId)) {
            const { conn } = connections.get(sessionId);
            conn?.end?.();
            connections.delete(sessionId);
        }
        
        // Delete storage
        let deleted = false;
        if (isMongoConnected) {
            await require('./utils/mongoAuth').deleteMongoSession(sessionId);
            deleted = true;
        } else {
            deleted = deleteSession(sessionId);
        }
        
        // Unpair from handler
        if (handler?.unpairNumber) {
            await handler.unpairNumber(sessionId);
        }
        
        res.json({ 
            success: true, 
            message: deleted ? `Session ${sessionId} deleted` : `Session ${sessionId} not found` 
        });
        
    } catch (err) {
        logger.error(`Delete session error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update Settings
app.post('/settings', async (req, res) => {
    try {
        const settings = req.body;
        
        if (handler?.saveGlobalSettings) {
            // Update handler settings
            if (handler.loadGlobalSettings) {
                const current = await handler.loadGlobalSettings();
                Object.assign(current, settings);
                await handler.saveGlobalSettings();
            }
            res.json({ success: true, message: 'Settings updated' });
        } else {
            res.status(400).json({ success: false, error: 'Settings management not available' });
        }
    } catch (err) {
        logger.error(`Settings update error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// === ERROR HANDLING ===
app.use((err, req, res, next) => {
    logger.error(`Express error: ${err.message}`, { stack: err.stack });
    res.status(500).json({ success: false, error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// === GRACEFUL SHUTDOWN ===
async function gracefulShutdown() {
    logger.info(fancy('🛑 Shutting down...'));
    
    // Close all connections
    for (const [id, data] of connections) {
        try {
            data.conn?.end?.();
            logger.info(fancy(`🔌 Closed ${id}`));
        } catch (e) {
            logger.error(`Error closing ${id}: ${e.message}`);
        }
    }
    
    // Close MongoDB
    if (isMongoConnected) {
        await mongoose.disconnect();
    }
    
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
});

// === START SERVER ===
async function startServer() {
    try {
        // Connect to MongoDB if configured
        await connectMongoDB();
        
        // Load handler settings
        if (handler?.loadGlobalSettings) {
            await handler.loadGlobalSettings();
        }
        
        // Start server
        app.listen(PORT, HOST, () => {
            logger.info(fancy(`🌐 Web Interface: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
            logger.info(fancy(`🔗 Pairing: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/pair?num=255XXXXXXXXX`));
            logger.info(fancy(`📋 Sessions: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/sessions`));
            logger.info(fancy(`❤️  Health: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/health`));
            logger.info(fancy(`👑 Developer: ${config.developer}`));
            logger.info(fancy(`💾 Version: ${config.version || '2.1.1'} | Year: 2025`));
        });
        
        // Start default bot for owner (optional)
        if (config.ownerNumber?.[0]) {
            logger.info(fancy(`🚀 Starting default bot for owner...`));
            startUserBot(config.ownerNumber[0]).catch(err => {
                logger.error(`Failed to start owner bot: ${err.message}`);
            });
        }
        
    } catch (err) {
        logger.error(fancy(`❌ Failed to start server: ${err.message}`));
        process.exit(1);
    }
}

// === EXPORTS ===
module.exports = { app, connections, startUserBot, requestPairingCode };

// === RUN ===
startServer();

