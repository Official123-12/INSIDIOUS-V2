const express = require('express');
const { 
    default: makeWASocket, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// ✅ **HANDLER (ORIGINAL - NO CHANGES)**
const handler = require('./handler');

// ✅ **FANCY FUNCTION**
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
 * Custom MongoDB auth state for Baileys - each session isolated
 */
async function useMongoAuthState(sessionId, mongoUri, dbName = 'whatsapp_sessions') {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db(dbName);
    const sessionsCollection = db.collection('sessions');
    const keysCollection = db.collection('session_keys');

    // Load or create session
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

    const authState = {
        creds: sessionDoc.creds || {},
        keys: {
            get: async (type, ids) => {
                const keys = {};
                const results = await keysCollection.find({
                    sessionId, type, id: { $in: ids }
                }).toArray();
                results.forEach(key => { keys[key.id] = key.key; });
                return keys;
            },
            set: async (data) => {
                const bulkOps = [];
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
                if (bulkOps.length > 0) await keysCollection.bulkWrite(bulkOps);
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
    }

    /**
     * Create NEW isolated session - phoneNumber becomes the OWNER of this bot instance
     */
    async createSession(sessionId, phoneNumber = null) {
        if (this.sessions.has(sessionId)) {
            console.log(fancy(`⚠️ Session ${sessionId} already active`));
            return { success: true, conn: this.sessions.get(sessionId).conn };
        }

        try {
            console.log(fancy(`🔐 Creating session: ${sessionId} | Owner: ${phoneNumber || 'pending'}`));
            
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

            // Store session with phoneNumber as OWNER
            this.sessions.set(sessionId, { 
                conn, saveCreds, clearSession, mongoClient, phoneNumber,
                createdAt: Date.now() 
            });

            // Setup listeners - handler.js handles the rest
            this._setupListeners(conn, sessionId, saveCreds, clearSession, phoneNumber);

            return { success: true, conn };
            
        } catch (error) {
            console.error(fancy(`❌ Failed to create session ${sessionId}: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    getSession(sessionId) { return this.sessions.get(sessionId); }

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
            console.error(fancy(`❌ Error removing ${sessionId}: ${error.message}`));
            return false;
        }
    }

    /**
     * Reconnect ALL sessions from MongoDB after Railway restart
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
     * Setup Baileys event listeners - handler.js does the heavy lifting
     */
    _setupListeners(conn, sessionId, saveCreds, clearSession, phoneNumber) {
        // Save credentials
        conn.ev.on('creds.update', saveCreds);

        // Connection state
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(fancy(`📱 QR ready for session: ${sessionId}`));
            }

            if (connection === 'open') {
                console.log(fancy(`✅ ${sessionId} connected: ${conn.user?.id}`));
                
                // Update MongoDB with connected status + owner number
                if (phoneNumber) {
                    const client = new MongoClient(this.mongoUri);
                    await client.connect();
                    const db = client.db('whatsapp_sessions');
                    await db.collection('sessions').updateOne(
                        { sessionId },
                        { $set: { phoneNumber, status: 'connected', connectedAt: new Date() } }
                    );
                    await client.close();
                }
                
                // Initialize handler (original signature: init(conn))
                if (handler?.init && typeof handler.init === 'function') {
                    try {
                        await handler.init(conn);
                    } catch (e) {
                        console.error(fancy(`❌ Handler init error: ${e.message}`));
                    }
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

        // Messages - handler.js receives (conn, m) as original
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m); // Original signature - no sessionId needed
                }
            } catch (error) {
                console.error(fancy(`❌ Message error: ${error.message}`));
            }
        });

        // Group updates
        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler?.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update); // Original signature
                }
            } catch (error) {
                console.error(fancy(`❌ Group update error: ${error.message}`));
            }
        });

        // Calls
        conn.ev.on('call', async (call) => {
            try {
                if (handler?.handleCall) {
                    await handler.handleCall(conn, call); // Original signature
                }
            } catch (error) {
                console.error(fancy(`❌ Call error: ${error.message}`));
            }
        });
    }

    /**
     * Request pairing code for a session
     */
    async requestPairingCode(sessionId, phoneNumber) {
        const session = this.sessions.get(sessionId);
        if (!session?.conn) throw new Error('Session not found');
        return await session.conn.requestPairingCode(phoneNumber);
    }
}

// ==================== EXPRESS SETUP ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ==================== CONFIG LOAD ====================
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("❌ Config error, using defaults"));
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

// ==================== API ENDPOINTS ====================

/**
 * 🔑 PAIRING: Creates NEW session per user
 * Owner = phoneNumber that links device
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
        
        // Generate unique session ID
        if (!sessionId) {
            const randomStr = crypto.randomBytes(4).toString('hex');
            sessionId = `sess_${cleanNum}_${Date.now()}_${randomStr}`;
        }
        
        console.log(fancy(`🔑 Creating session ${sessionId} for owner: ${cleanNum}`));
        
        // Create NEW isolated session - this number becomes the OWNER
        const result = await sessionManager.createSession(sessionId, cleanNum);
        if (!result.success) {
            return res.json({ success: false, error: result.error });
        }
        
        // Request pairing code
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
            message: `✅ Code: ${code}\n🔑 Session ID: ${sessionId}\n👑 You are the OWNER of this bot instance`
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
 * 🗑️ UNPAIR: Remove session by number or sessionId
 */
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        let sessionId = req.query.sessionId;
        
        if (!num && !sessionId) {
            return res.json({ success: false, error: "Provide number OR sessionId" });
        }
        
        if (sessionId) {
            const removed = await sessionManager.removeSession(sessionId);
            return res.json({ 
                success: removed, 
                message: removed ? `Session ${sessionId} removed` : "Session not found"
            });
        }
        
        // Find by phone number
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
 * 🚀 DEPLOY: User activates session via website
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
            // Reconnect if not in memory (after restart)
            await sessionManager.createSession(sessionId, cleanNum);
        }
        
        // Update MongoDB - this number is the OWNER
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
            message: "✅ Session deployed! You are now the OWNER of this bot instance.",
            sessionId,
            ownerNumber: cleanNum
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
            ownerNumber: data.phoneNumber,
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
 * 🤖 BOT INFO (shows first connected session)
 */
app.get('/botinfo', (req, res) => {
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
        ownerNumber: data.phoneNumber,
        botName: data.conn.user?.name || "INSIDIOUS",
        botNumber: data.conn.user?.id?.split(':')[0] || "Unknown",
        botJid: data.conn.user?.id || "Unknown",
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
        console.log(fancy("✅ MongoDB Connected"));
    } catch (err) {
        console.log(fancy("⚠️ Mongoose warning (MongoDB client will still work)"));
    }

    // Reconnect saved sessions BEFORE starting server
    console.log(fancy("🔄 Loading saved sessions..."));
    await sessionManager.reconnectAllSessions();

    // Start Express
    app.listen(PORT, '0.0.0.0', () => {
        console.log(fancy("🌐 Server: http://localhost:" + PORT));
        console.log(fancy("🔗 Pair: /pair?num=255XXXXXXXXX"));
        console.log(fancy("🗑️ Unpair: /unpair?num=255XXXXXXXXX"));
        console.log(fancy("🚀 Deploy: POST /deploy {phoneNumber, sessionId}"));
        console.log(fancy("📊 Sessions: /sessions"));
        console.log(fancy("❤️ Health: /health"));
        console.log(fancy("👑 Developer: STANYTZ"));
        console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log(fancy("🛑 Shutting down..."));
    for (const [id] of sessionManager.sessions) {
        await sessionManager.removeSession(id);
    }
    await mongoose.connection?.close();
    process.exit(0);
});

// Start
startServer();

module.exports = { app, sessionManager };

