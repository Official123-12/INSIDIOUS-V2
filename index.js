const express = require('express');
const { 
    default: makeWASocket, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason,
    useMultiFileAuthState // We'll replace this with MongoDB version
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');

// ✅ **HANDLER**
const handler = require('./handler');

// ✅ **FANCY FUNCTION** (unchanged)
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const fancyMap = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
        };
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            result += fancyMap[char] || char;
        }
        return result;
    } catch (e) { return text; }
}

// ==================== CONFIG ====================
const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

// ==================== MONGODB AUTH STATE ====================
/**
 * Custom MongoDB-based auth state for Baileys
 * Each session is isolated with unique sessionId
 */
async function useMongoAuthState(sessionId, mongoUri, dbName = 'whatsapp_sessions') {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db(dbName);
    const sessionsCollection = db.collection('sessions');
    const keysCollection = db.collection('session_keys');

    // Load or initialize session document
    let sessionDoc = await sessionsCollection.findOne({ sessionId });
    if (!sessionDoc) {
        sessionDoc = {
            sessionId,
            creds: {},
            createdAt: new Date(),
            lastActive: new Date(),
            phoneNumber: null,
            status: 'pending'
        };
        await sessionsCollection.insertOne(sessionDoc);
    }

    // Auth state object Baileys expects
    const authState = {
        creds: sessionDoc.creds || {},
        keys: {
            get: async (type, ids) => {
                const keys = {};
                // Normalize: type might be 'pre-key', 'session', etc.
                const results = await keysCollection.find({
                    sessionId,
                    type,
                    id: { $in: ids }
                }).toArray();
                results.forEach(key => { keys[key.id] = key.key; });
                return keys;
            },
            set: async (data) => {
                const bulkOps = [];
                // data format: { 'pre-key': { '123': keyData }, 'session': {...} }
                for (const [type, entries] of Object.entries(data)) {
                    for (const [id, key] of Object.entries(entries)) {
                        bulkOps.push({
                            updateOne: {
                                filter: { sessionId, type, id },
                                update: { 
                                    $set: { key, updatedAt: new Date() },
                                    $setOnInsert: { sessionId, type, id, createdAt: new Date() }
                                },
                                upsert: true
                            }
                        });
                    }
                }
                if (bulkOps.length > 0) {
                    await keysCollection.bulkWrite(bulkOps);
                }
            }
        }
    };

    const saveCreds = async () => {
        await sessionsCollection.updateOne(
            { sessionId },
            { $set: { creds: authState.creds, lastActive: new Date(), status: 'connected' } }
        );
    };

    const clearSession = async () => {
        await sessionsCollection.deleteOne({ sessionId });
        await keysCollection.deleteMany({ sessionId });
    };

    return { state: authState, saveCreds, clearSession, mongoClient: client };
}

// ==================== SESSION MANAGER ====================
class SessionManager {
    constructor(mongoUri) {
        this.mongoUri = mongoUri;
        this.sessions = new Map(); // sessionId -> { conn, saveCreds, clearSession, mongoClient, phoneNumber }
        this.handler = null;
    }

    setHandler(h) { this.handler = h; }

    /**
     * Create a NEW isolated WhatsApp session for a user
     */
    async createSession(sessionId, phoneNumber = null) {
        if (this.sessions.has(sessionId)) {
            console.log(fancy(`⚠️ Session ${sessionId} already exists`));
            return { success: true, conn: this.sessions.get(sessionId).conn };
        }

        try {
            console.log(fancy(`🔐 Initializing session: ${sessionId}`));
            
            const { state, saveCreds, clearSession, mongoClient } = await useMongoAuthState(
                sessionId, this.mongoUri
            );
            
            const { version } = await fetchLatestBaileysVersion();
            
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
                printQRInTerminal: false,
                markOnlineOnConnect: true
            });

            // Store session
            this.sessions.set(sessionId, { 
                conn, saveCreds, clearSession, mongoClient, phoneNumber, 
                createdAt: Date.now() 
            });

            // Setup event listeners
            this._setupListeners(conn, sessionId, saveCreds, clearSession, phoneNumber);

            return { success: true, conn };
            
        } catch (error) {
            console.error(fancy(`❌ Failed to create session ${sessionId}: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    /**
     * Get session by ID
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Disconnect and clean up a session
     */
    async removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        try {
            session.conn?.end?.();
            session.mongoClient?.close?.();
            await session.clearSession?.();
            this.sessions.delete(sessionId);
            console.log(fancy(`🗑️ Session removed: ${sessionId}`));
            return true;
        } catch (error) {
            console.error(fancy(`❌ Error removing session ${sessionId}: ${error.message}`));
            return false;
        }
    }

    /**
     * Reconnect ALL saved sessions from MongoDB (Railway restart recovery)
     */
    async reconnectAllSessions() {
        try {
            const client = new MongoClient(this.mongoUri);
            await client.connect();
            const db = client.db('whatsapp_sessions');
            
            const activeSessions = await db.collection('sessions')
                .find({ status: 'connected' })
                .project({ sessionId: 1, phoneNumber: 1 })
                .toArray();

            console.log(fancy(`🔄 Reconnecting ${activeSessions.length} saved sessions...`));
            
            for (const doc of activeSessions) {
                const { sessionId, phoneNumber } = doc;
                console.log(fancy(`  ↪ ${phoneNumber || sessionId}`));
                await this.createSession(sessionId, phoneNumber);
            }
            
            await client.close();
            console.log(fancy(`✅ Reconnection complete`));
            
        } catch (error) {
            console.error(fancy(`❌ Reconnection failed: ${error.message}`));
        }
    }

    /**
     * Setup Baileys event listeners for a session
     */
    _setupListeners(conn, sessionId, saveCreds, clearSession, phoneNumber) {
        // Save credentials on update
        conn.ev.on('creds.update', saveCreds);

        // Connection state
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Optional: emit via WebSocket to frontend for QR display
                console.log(fancy(`📱 QR ready for session: ${sessionId}`));
            }

            if (connection === 'open') {
                console.log(fancy(`✅ ${sessionId} connected: ${conn.user?.id}`));
                
                // Initialize handler with session context
                if (this.handler?.init && typeof this.handler.init === 'function') {
                    try {
                        await this.handler.init(conn, sessionId);
                    } catch (e) {
                        console.error(fancy(`❌ Handler init error for ${sessionId}: ${e.message}`));
                    }
                }

                // Send welcome to owner (only for first session or if configured)
                if (phoneNumber && config?.ownerNumber?.includes(phoneNumber)) {
                    this._sendWelcome(conn, sessionId, phoneNumber);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    console.log(fancy(`🔄 ${sessionId} reconnecting in 5s...`));
                    setTimeout(() => {
                        this.createSession(sessionId, phoneNumber);
                    }, 5000);
                } else {
                    console.log(fancy(`🚫 ${sessionId} logged out`));
                    this.removeSession(sessionId);
                }
            }
        });

        // Messages
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (this.handler && typeof this.handler === 'function') {
                    await this.handler(conn, m, sessionId); // Pass sessionId to handler
                }
            } catch (error) {
                console.error(fancy(`❌ Message error [${sessionId}]: ${error.message}`));
            }
        });

        // Group updates
        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (this.handler?.handleGroupUpdate) {
                    await this.handler.handleGroupUpdate(conn, update, sessionId);
                }
            } catch (error) {
                console.error(fancy(`❌ Group update error [${sessionId}]: ${error.message}`));
            }
        });

        // Calls
        conn.ev.on('call', async (call) => {
            try {
                if (this.handler?.handleCall) {
                    await this.handler.handleCall(conn, call, sessionId);
                }
            } catch (error) {
                console.error(fancy(`❌ Call error [${sessionId}]: ${error.message}`));
            }
        });
    }

    /**
     * Send welcome message to owner
     */
    async _sendWelcome(conn, sessionId, phoneNumber) {
        setTimeout(async () => {
            try {
                const ownerJid = phoneNumber + '@s.whatsapp.net';
                const botName = conn.user?.name || "INSIDIOUS";
                const botNumber = conn.user?.id?.split(':')[0] || "Unknown";
                const botSecret = this.handler?.getBotId?.() || 'Unknown';
                const pairedCount = this.handler?.getPairedNumbers?.().length || 0;

                const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🆔 *Bot ID:* ${botSecret}
👥 *Paired Owners:* ${pairedCount}
🔑 *Session:* \`${sessionId}\`

⚡ *Status:* ONLINE & ACTIVE

👑 *Developer:* STANYTZ
💾 *Version:* 2.1.1 | Year: 2025`;

                await conn.sendMessage(ownerJid, { 
                    image: { url: config?.botImage || "https://files.catbox.moe/f3c07u.jpg" },
                    caption: welcomeMsg,
                    contextInfo: { 
                        isForwarded: true,
                        forwardingScore: 999
                    }
                });
                console.log(fancy(`✅ Welcome sent to ${phoneNumber}`));
            } catch (e) {
                console.log(fancy(`⚠️ Welcome failed: ${e.message}`));
            }
        }, 3000);
    }

    /**
     * Generate pairing code for a phone number in a specific session
     */
    async requestPairingCode(sessionId, phoneNumber) {
        const session = this.sessions.get(sessionId);
        if (!session?.conn) {
            throw new Error('Session not found or not connected');
        }
        return await session.conn.requestPairingCode(phoneNumber);
    }
}

// ==================== EXPRESS SETUP ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create public folder if missing
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// Simple routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ==================== GLOBAL STATE ====================
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("❌ Config file error, using defaults"));
    config = {
        prefix: '.',
        ownerNumber: ['255000000000'],
        botName: 'INSIDIOUS',
        workMode: 'public',
        botImage: 'https://files.catbox.moe/f3c07u.jpg'
    };
}

// Initialize Session Manager
const sessionManager = new SessionManager(MONGODB_URI);
sessionManager.setHandler(handler);

// ==================== API ENDPOINTS ====================

/**
 * 🔑 PAIRING ENDPOINT - Creates NEW session per user
 * Usage: /pair?num=255787069580&sessionId=optional_custom_id
 */
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        let sessionId = req.query.sessionId;
        
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }
        
        // Generate unique session ID if not provided
        if (!sessionId) {
            const randomStr = crypto.randomBytes(4).toString('hex');
            sessionId = `sess_${cleanNum}_${Date.now()}_${randomStr}`;
        }
        
        console.log(fancy(`🔑 Creating session ${sessionId} for: ${cleanNum}`));
        
        // Create NEW isolated session (won't affect others!)
        const result = await sessionManager.createSession(sessionId, cleanNum);
        if (!result.success) {
            return res.json({ success: false, error: result.error });
        }
        
        // Request pairing code with timeout
        const code = await Promise.race([
            sessionManager.requestPairingCode(sessionId, cleanNum),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 30000)
            )
        ]);
        
        res.json({ 
            success: true, 
            code: code,
            sessionId: sessionId,
            message: `✅ 8-digit code: ${code}\n🔑 Session ID: ${sessionId}`
        });
        
    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ 
            success: false, 
            error: err.message.includes('already paired') 
                ? "Number already paired" 
                : "Failed: " + err.message 
        });
    }
});

/**
 * 🗑️ UNPAIR ENDPOINT
 */
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        let sessionId = req.query.sessionId;
        
        if (!num && !sessionId) {
            return res.json({ success: false, error: "Provide number OR sessionId" });
        }
        
        // If sessionId provided, remove directly
        if (sessionId) {
            const removed = await sessionManager.removeSession(sessionId);
            return res.json({ 
                success: removed, 
                message: removed ? `Session ${sessionId} removed` : "Session not found"
            });
        }
        
        // Otherwise find by phone number
        const cleanNum = num.replace(/[^0-9]/g, '');
        let found = false;
        
        for (const [sid, data] of sessionManager.sessions) {
            if (data.phoneNumber === cleanNum) {
                await sessionManager.removeSession(sid);
                found = true;
                break;
            }
        }
        
        // Also remove from DB if not in memory
        if (!found) {
            const client = new MongoClient(MONGODB_URI);
            await client.connect();
            const db = client.db('whatsapp_sessions');
            const result = await db.collection('sessions').deleteOne({ phoneNumber: cleanNum });
            await client.close();
            found = result.deletedCount > 0;
        }
        
        res.json({ 
            success: found, 
            message: found ? `Number ${cleanNum} unpaired` : "Number not found"
        });
        
    } catch (err) {
        console.error("Unpair error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

/**
 * 🚀 DEPLOY ENDPOINT - User activates session via website
 * POST /deploy { phoneNumber: "255...", sessionId: "sess_..." }
 */
app.post('/deploy', async (req, res) => {
    try {
        const { phoneNumber, sessionId } = req.body;
        
        if (!phoneNumber || !sessionId) {
            return res.status(400).json({ success: false, error: "phoneNumber and sessionId required" });
        }
        
        const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
        const session = sessionManager.getSession(sessionId);
        
        if (!session) {
            // Session might exist in DB but not in memory (after restart)
            // Try to reconnect it
            await sessionManager.createSession(sessionId, cleanNum);
        }
        
        // Update MongoDB with deployment info
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('whatsapp_sessions');
        
        await db.collection('sessions').updateOne(
            { sessionId },
            { 
                $set: { 
                    phoneNumber: cleanNum, 
                    deployedAt: new Date(),
                    status: 'connected'
                } 
            },
            { upsert: true }
        );
        await client.close();
        
        res.json({ 
            success: true, 
            message: "✅ Session deployed! Bot is now active.",
            sessionId,
            phoneNumber: cleanNum
        });
        
    } catch (err) {
        console.error("Deploy error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 📊 GET ALL ACTIVE SESSIONS
 */
app.get('/sessions', (req, res) => {
    const sessions = [];
    for (const [id, data] of sessionManager.sessions) {
        sessions.push({
            sessionId: id,
            phoneNumber: data.phoneNumber,
            connected: data.conn?.user ? true : false,
            botName: data.conn?.user?.name,
            botJid: data.conn?.user?.id,
            createdAt: data.createdAt
        });
    }
    res.json({ success: true, count: sessions.length, sessions });
});

/**
 * ❤️ HEALTH CHECK
 */
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    res.json({
        status: 'healthy',
        activeSessions: sessionManager.sessions.size,
        uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    });
});

/**
 * 🤖 BOT INFO (legacy - now shows first session)
 */
app.get('/botinfo', (req, res) => {
    // Return info about first connected session
    let firstSession = null;
    for (const [id, data] of sessionManager.sessions) {
        if (data.conn?.user) {
            firstSession = { id, data };
            break;
        }
    }
    
    if (!firstSession) {
        return res.json({ success: false, error: "No active sessions", connected: false });
    }
    
    const { id, data } = firstSession;
    res.json({
        success: true,
        sessionId: id,
        botName: data.conn.user?.name || "INSIDIOUS",
        botNumber: data.conn.user?.id?.split(':')[0] || "Unknown",
        botJid: data.conn.user?.id || "Unknown",
        phoneNumber: data.phoneNumber,
        connected: true,
        uptime: Date.now() - data.createdAt
    });
});

// ==================== STARTUP ====================
async function startServer() {
    console.log(fancy("🔗 Connecting to MongoDB..."));
    
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
        });
        console.log(fancy("✅ MongoDB Connected (Mongoose)"));
    } catch (err) {
        console.log(fancy("❌ Mongoose connection warning (MongoDB client will still work)"));
        console.log(fancy("💡 Error: " + err.message));
    }

    // Reconnect saved sessions BEFORE starting server
    console.log(fancy("🔄 Loading saved sessions..."));
    await sessionManager.reconnectAllSessions();

    // Start Express
    app.listen(PORT, '0.0.0.0', () => {
        console.log(fancy("🌐 Web Interface: http://localhost:" + PORT));
        console.log(fancy("🔗 Pairing: /pair?num=255XXXXXXXXX"));
        console.log(fancy("🗑️ Unpair: /unpair?num=255XXXXXXXXX&sessionId=..."));
        console.log(fancy("🚀 Deploy: POST /deploy {phoneNumber, sessionId}"));
        console.log(fancy("📊 Sessions: /sessions"));
        console.log(fancy("❤️ Health: /health"));
        console.log(fancy("👑 Developer: STANYTZ"));
        console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
        console.log(fancy("🙏 Special Thanks: REDTECH"));
    });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(fancy("🛑 Shutting down..."));
    for (const [id] of sessionManager.sessions) {
        await sessionManager.removeSession(id);
    }
    await mongoose.connection?.close();
    process.exit(0);
});

// Start everything
startBot = startServer; // Keep compatibility if handler references startBot
startServer();

module.exports = { app, sessionManager };

