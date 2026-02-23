const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
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

// ==================== HANDLER ====================
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

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION**
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
});

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// ✅ **GLOBAL SESSION MANAGER**
const activeSessions = new Map(); // Map<sessionId, { conn, saveCreds, wipeCreds, mongoClient }>
let defaultConn = null;
let botStartTime = Date.now();

// ✅ **LOAD CONFIG**
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

// ✅ **MONGODB AUTH STATE HELPER (INLINE - No external file needed)**
async function useMongoAuthState(sessionId, mongoUri) {
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db('whatsapp_bot');
    const collection = db.collection('baileys_sessions');
    
    // Load or init creds
    let doc = await collection.findOne({ _id: sessionId });
    if (!doc) {
        doc = { _id: sessionId, creds: {}, keys: {} };
        await collection.insertOne(doc);
    }
    
    // In-memory cache for keys
    const keys = {
        get: async (type, ids) => {
            const keyMap = doc.keys[type] || {};
            return ids.reduce((acc, id) => {
                if (keyMap[id]) acc[id] = keyMap[id];
                return acc;
            }, {});
        },
        set: async (data) => {
            for (const [type, values] of Object.entries(data)) {
                if (!doc.keys[type]) doc.keys[type] = {};
                Object.assign(doc.keys[type], values);
            }
            await collection.updateOne({ _id: sessionId }, { $set: { keys: doc.keys } });
        }
    };
    
    const saveCreds = async () => {
        await collection.updateOne({ _id: sessionId }, { $set: { creds: doc.creds } });
    };
    
    const wipeCreds = async () => {
        await collection.deleteOne({ _id: sessionId });
        doc = { _id: sessionId, creds: {}, keys: {} };
    };
    
    // Baileys expects creds to be reactive - we proxy it
    const creds = new Proxy(doc.creds, {
        set: (target, key, value) => {
            target[key] = value;
            saveCreds(); // Auto-save on change
            return true;
        }
    });
    
    return {
        state: { creds, keys },
        saveCreds,
        wipeCreds,
        client
    };
}

// ✅ **MAIN BOT FUNCTION - MULTI-SESSION SUPPORT**
async function startBot(sessionId = 'default') {
    try {
        console.log(fancy(`🚀 Starting session: ${sessionId}`));
        
        // ✅ MONGODB AUTH STATE (per session)
        const { state, saveCreds, wipeCreds, client } = await useMongoAuthState(sessionId, MONGODB_URI);
        const { version } = await fetchLatestBaileysVersion();

        // ✅ CREATE CONNECTION
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
            markOnlineOnConnect: true
        });

        // Store connection reference
        activeSessions.set(sessionId, { conn, saveCreds, wipeCreds, client });
        if (sessionId === 'default') defaultConn = conn;

        // ✅ CONNECTION EVENTS
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy(`✅ Session ${sessionId} is ONLINE`));
                
                // Send welcome ONLY for default/owner session
                if (sessionId === 'default') {
                    let botName = conn.user?.name || "INSIDIOUS";
                    let botNumber = conn.user?.id?.split(':')[0] || "Unknown";
                    const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
                    const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
                    
                    console.log(fancy(`🤖 Name: ${botName}`));
                    console.log(fancy(`📞 Number: ${botNumber}`));
                    console.log(fancy(`🆔 Bot ID: ${botSecret}`));
                    console.log(fancy(`👥 Paired Owners: ${pairedCount}`));
                    
                    // Initialize handler
                    if (handler && typeof handler.init === 'function') {
                        await handler.init(conn);
                        console.log(fancy("✅ Handler initialized"));
                    }
                    
                    // Send welcome to owner
                    setTimeout(async () => {
                        try {
                            if (config.ownerNumber?.[0]) {
                                const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
                                if (ownerNum.length >= 10) {
                                    const ownerJid = ownerNum + '@s.whatsapp.net';
                                    const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🆔 *Bot ID:* ${botSecret}
👥 *Paired Owners:* ${pairedCount}

⚡ *Status:* ONLINE & ACTIVE
👑 *Developer:* STANYTZ
💾 *Version:* 2.1.1 | Year: 2025`;
                                    
                                    await conn.sendMessage(ownerJid, { 
                                        image: { url: config.botImage },
                                        caption: welcomeMsg,
                                        contextInfo: { 
                                            isForwarded: true,
                                            forwardingScore: 999
                                        }
                                    });
                                    console.log(fancy("✅ Welcome message sent to owner"));
                                }
                            }
                        } catch (e) {
                            console.log(fancy("⚠️ Could not send welcome:"), e.message);
                        }
                    }, 3000);
                }
            }
            
            if (connection === 'close') {
                console.log(fancy(`🔌 Session ${sessionId} closed`));
                activeSessions.delete(sessionId);
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(fancy(`🔄 Reconnecting ${sessionId} in 5s...`));
                    setTimeout(() => startBot(sessionId), 5000);
                } else {
                    if (wipeCreds) await wipeCreds();
                    if (client) await client.close();
                    console.log(fancy(`🚫 Session ${sessionId} logged out. Credentials cleared.`));
                }
            }
        });

        // ✅ CRITICAL: Save credentials on every update (for persistence)
        conn.ev.on('creds.update', async () => {
            await saveCreds();
        });

        // ✅ MESSAGE HANDLER (pass sessionId context)
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m, { sessionId });
                }
            } catch (error) {
                console.error("Message handler error:", error.message);
            }
        });

        // ✅ GROUP UPDATE HANDLER
        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler?.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update, { sessionId });
                }
            } catch (error) {
                console.error("Group update error:", error.message);
            }
        });

        // ✅ CALL HANDLER
        conn.ev.on('call', async (call) => {
            try {
                if (handler?.handleCall) {
                    await handler.handleCall(conn, call, { sessionId });
                }
            } catch (error) {
                console.error("Call handler error:", error.message);
            }
        });

        console.log(fancy(`✅ Session ${sessionId} ready for pairing`));
        return conn;
        
    } catch (error) {
        console.error(fancy(`❌ Start error for ${sessionId}:`), error.message);
        setTimeout(() => startBot(sessionId), 10000);
        throw error;
    }
}

// ✅ **AUTO-RESTORE SESSIONS ON STARTUP**
async function restoreSessions() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('whatsapp_bot');
        
        const sessions = await db.collection('baileys_sessions')
            .find({})
            .project({ _id: 1 })
            .toArray();
        
        await client.close();
        
        console.log(fancy(`🔄 Found ${sessions.length} stored sessions`));
        
        for (const session of sessions) {
            const sessionId = session._id;
            if (sessionId !== 'default' && !activeSessions.has(sessionId)) {
                console.log(fancy(`🔁 Restoring session: ${sessionId}`));
                startBot(sessionId).catch(err => {
                    console.error(fancy(`❌ Failed to restore ${sessionId}:`), err.message);
                });
            }
        }
    } catch (err) {
        console.error(fancy("❌ Session restore error:"), err.message);
    }
}

// ✅ **PAIRING ENDPOINT - MULTI-SESSION SUPPORT**
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
        
        // Use phone number as sessionId if not provided
        sessionId = sessionId || cleanNum;
        
        console.log(fancy(`🔑 Generating pairing code for session: ${sessionId}`));
        
        // Check if session already exists & is connected
        let sessionData = activeSessions.get(sessionId);
        
        // If not connected, start new session for this user
        if (!sessionData || !sessionData.conn?.user) {
            console.log(fancy(`🆕 Creating new session for ${sessionId}`));
            const conn = await startBot(sessionId);
            sessionData = activeSessions.get(sessionId);
            
            // Wait for connection to be ready (max 30s)
            let attempts = 0;
            while (!sessionData.conn?.user && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
            
            if (!sessionData.conn?.user) {
                return res.json({ success: false, error: "Failed to initialize session" });
            }
        }
        
        // Generate pairing code
        const code = await Promise.race([
            sessionData.conn.requestPairingCode(cleanNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
        ]);
        
        // Return sessionId so frontend can track this session
        res.json({ 
            success: true, 
            code: code,
            sessionId: sessionId,
            message: `Use this code in WhatsApp: ${code}`
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

// ✅ **UNPAIR ENDPOINT**
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        let sessionId = req.query.sessionId || num.replace(/[^0-9]/g, '');
        
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /unpair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number" });
        }
        
        // Call handler to unpair
        let result = false;
        if (handler && handler.unpairNumber) {
            result = await handler.unpairNumber(cleanNum, { sessionId });
        } else {
            // Fallback: wipe credentials from MongoDB
            const sessionData = activeSessions.get(sessionId);
            if (sessionData?.wipeCreds) {
                await sessionData.wipeCreds();
                if (sessionData.client) await sessionData.client.close();
                activeSessions.delete(sessionId);
                result = true;
            }
        }
        
        res.json({ 
            success: result, 
            message: result ? `Number ${cleanNum} unpaired successfully` : `Failed to unpair ${cleanNum}`
        });
        
    } catch (err) {
        console.error("Unpair error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ **HEALTH CHECK**
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        status: 'healthy',
        activeSessions: activeSessions.size,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ✅ **BOT INFO ENDPOINT**
app.get('/botinfo', (req, res) => {
    const sessionId = req.query.sessionId || 'default';
    const sessionData = activeSessions.get(sessionId);
    
    if (!sessionData || !sessionData.conn?.user) {
        return res.json({ 
            success: false,
            error: "Session not connected",
            sessionId: sessionId
        });
    }
    
    const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
    const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
    
    res.json({
        success: true,
        sessionId: sessionId,
        botName: sessionData.conn.user?.name || "INSIDIOUS",
        botNumber: sessionData.conn.user?.id?.split(':')[0] || "Unknown",
        botJid: sessionData.conn.user?.id || "Unknown",
        botSecret: botSecret,
        pairedOwners: pairedCount,
        connected: true,
        uptime: Date.now() - botStartTime
    });
});

// ✅ **START DEFAULT BOT + RESTORE SESSIONS**
async function initialize() {
    // Start default/owner bot
    await startBot('default');
    
    // Restore other sessions after MongoDB is ready
    mongoose.connection.once('open', () => {
        console.log(fancy("✅ MongoDB ready, restoring sessions..."));
        restoreSessions();
    });
}

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo?sessionId=255XXXXXXXXX`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
    
    // Initialize bot
    initialize();
});

module.exports = app;

