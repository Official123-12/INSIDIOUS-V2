const express = require('express');
const { default: makeWASocket, Browsers, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// Import handler
const handler = require('./handler');

// Import custom MongoDB auth state
const useMongoAuthState = require('./mongoAuthState');

// Import Session model
const Session = require('./models/Session');

// ==================== FANCY FUNCTION ====================
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
    } catch (e) {
        return text;
    }
}

// ==================== RANDOM MEGA ID ====================
function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MONGODB CONNECTION (Sila Cluster) ====================
console.log(fancy("🔗 Connecting to MongoDB (Sila)..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

// Connection options – increase timeouts
const mongooseOptions = {
    serverSelectionTimeoutMS: 60000,      // 60 seconds
    socketTimeoutMS: 90000,               // 90 seconds
    connectTimeoutMS: 60000,               // 60 seconds
    maxPoolSize: 20,
    minPoolSize: 5,
    retryWrites: true,
    retryReads: true
};

let isMongoConnected = false;

async function connectToMongo() {
    try {
        await mongoose.connect(MONGODB_URI, mongooseOptions);
        console.log(fancy("✅ MongoDB Connected (Sila)"));
        isMongoConnected = true;
        
        // Safisha sessions zisizo kamili
        await cleanupInvalidSessions();
        // Anzisha sessions zilizo active
        await startAllActiveSessions();
    } catch (err) {
        console.log(fancy("❌ MongoDB Connection FAILED"));
        console.log(fancy("💡 Error: " + err.message));
        isMongoConnected = false;
        // Jaribu kuunganisha tena baada ya sekunde 30
        setTimeout(connectToMongo, 30000);
    }
}

// Anza kuunganisha MongoDB
connectToMongo();

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure public folder exists
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ==================== SIMPLE ROUTES ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ==================== GLOBAL VARIABLES ====================
const activeSockets = new Map(); // sessionId -> WASocket
let botStartTime = Date.now();

// ==================== LOAD CONFIG ====================
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

// ==================== CLEANUP INVALID SESSIONS ====================
async function cleanupInvalidSessions() {
    try {
        const result = await Session.deleteMany({
            $or: [
                { creds: { $exists: false } },
                { creds: null },
                { "creds.me": { $exists: false } }
            ]
        });
        console.log(fancy(`🧹 Cleaned up ${result.deletedCount} invalid sessions`));
        
        await Session.updateMany({ status: 'active' }, { status: 'inactive' });
        console.log(fancy(`📝 Reset all sessions to inactive`));
    } catch (error) {
        console.error("Error cleaning sessions:", error.message);
    }
}

// ==================== FUNCTION TO START A SINGLE USER BOT ====================
async function startUserBot(sessionId, phoneNumber) {
    if (activeSockets.has(sessionId)) {
        console.log(fancy(`⚠️ Session ${sessionId} already running`));
        return;
    }

    try {
        const { state, saveCreds } = await useMongoAuthState(sessionId);
        
        if (!state.creds || !state.creds.me || !state.creds.me.id) {
            console.log(fancy(`⚠️ Session ${sessionId} has invalid credentials. Marking as expired.`));
            await Session.updateOne({ sessionId }, { status: 'expired' });
            return;
        }

        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: state.keys
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            shouldSyncHistoryMessage: () => false
        });

        activeSockets.set(sessionId, conn);

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy(`✅ Session ${sessionId} (${phoneNumber}) connected`));
                await Session.updateOne({ sessionId }, { status: 'active' });
            }
            
            if (connection === 'close') {
                console.log(fancy(`🔌 Session ${sessionId} connection closed`));
                activeSockets.delete(sessionId);
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(fancy(`🔄 Reconnecting session ${sessionId} in 5 seconds...`));
                    setTimeout(() => {
                        startUserBot(sessionId, phoneNumber);
                    }, 5000);
                } else {
                    console.log(fancy(`🚫 Session ${sessionId} logged out.`));
                    await Session.updateOne({ sessionId }, { status: 'expired' });
                }
            }
        });

        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m);
                }
            } catch (error) {
                console.error(`Message handler error for ${sessionId}:`, error.message);
            }
        });

        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler && handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update);
                }
            } catch (error) {
                console.error(`Group update error for ${sessionId}:`, error.message);
            }
        });

        conn.ev.on('call', async (call) => {
            try {
                if (handler && handler.handleCall) {
                    await handler.handleCall(conn, call);
                }
            } catch (error) {
                console.error(`Call handler error for ${sessionId}:`, error.message);
            }
        });

        console.log(fancy(`🚀 User bot started for session ${sessionId} (${phoneNumber})`));

    } catch (error) {
        console.error(`Error starting user bot ${sessionId}:`, error.message);
        await Session.updateOne({ sessionId }, { status: 'expired' });
    }
}

// ==================== FUNCTION TO START ALL ACTIVE SESSIONS FROM DB ====================
async function startAllActiveSessions() {
    try {
        const activeSessions = await Session.find({ status: 'active' });
        console.log(fancy(`📦 Found ${activeSessions.length} active sessions to start`));
        
        for (const session of activeSessions) {
            if (!session.creds || !session.creds.me || !session.creds.me.id) {
                console.log(fancy(`⚠️ Session ${session.sessionId} has invalid creds, marking expired`));
                await Session.updateOne({ _id: session._id }, { status: 'expired' });
                continue;
            }
            startUserBot(session.sessionId, session.phoneNumber);
        }
    } catch (error) {
        console.error(fancy("❌ Error loading active sessions:"), error.message);
    }
}

// ==================== HTTP ENDPOINTS ====================

// ✅ PAIRING ENDPOINT
app.get('/pair', async (req, res) => {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
        return res.json({ success: false, error: "MongoDB not connected. Please try again later." });
    }
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }
        
        const sessionId = randomMegaId(6, 4);
        
        const { state, saveCreds } = await useMongoAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const tempConn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: state.keys },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
        });

        let pairingCode = await tempConn.requestPairingCode(cleanNum);
        
        const connectionPromise = new Promise((resolve, reject) => {
            tempConn.ev.on('connection.update', (up) => {
                if (up.connection === 'open') {
                    resolve();
                } else if (up.connection === 'close') {
                    reject(new Error('Connection closed'));
                }
            });
        });

        await Promise.race([
            connectionPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 120000))
        ]);

        await new Promise(resolve => setTimeout(resolve, 3000));
        await saveCreds();

        const savedSession = await Session.findOne({ sessionId });
        if (!savedSession || !savedSession.creds || !savedSession.creds.me) {
            throw new Error("Failed to save credentials properly");
        }

        savedSession.status = 'inactive';
        savedSession.phoneNumber = cleanNum;
        await savedSession.save();

        const welcomeMessage = `
╭─── • 🥀 • ───╮
   INSIDIOUS: PAIRING SUCCESS
╰─── • 🥀 • ───╯

✅ *Your WhatsApp has been linked!*
🆔 *Your Session ID:* ${sessionId}

📌 *Next Steps:*
1. Copy your Session ID above.
2. Go to our website: ${req.protocol}://${req.get('host')}
3. Enter your phone number and Session ID in the Deploy section.
4. Your bot will start immediately.

⚡ *Bot will be active after deployment.*
👑 *Developer:* STANYTZ
        `;
        await tempConn.sendMessage(cleanNum + '@s.whatsapp.net', { text: welcomeMessage });
        await tempConn.sendMessage(cleanNum + '@s.whatsapp.net', { text: sessionId });

        tempConn.end();

        res.json({
            success: true,
            code: pairingCode,
            sessionId: sessionId,
            message: "Pairing successful! Check your WhatsApp."
        });

    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ DEPLOY ENDPOINT
app.post('/deploy', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.json({ success: false, error: "MongoDB not connected. Please try again later." });
    }
    try {
        const { sessionId, number } = req.body;
        if (!sessionId || !number) {
            return res.json({ success: false, error: "Missing sessionId or number" });
        }

        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.json({ success: false, error: "Session not found" });
        }

        if (!session.creds || !session.creds.me || !session.creds.me.id) {
            return res.json({ success: false, error: "Session credentials are invalid. Please pair again." });
        }

        session.status = 'active';
        session.phoneNumber = number;
        await session.save();

        if (!activeSockets.has(sessionId)) {
            startUserBot(sessionId, number);
        }

        res.json({ success: true, message: "Bot deployed successfully" });
    } catch (err) {
        console.error("Deploy error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ GET ALL SESSIONS
app.get('/sessions', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.json({ success: false, error: "MongoDB not connected" });
    }
    try {
        const sessions = await Session.find({}, { sessionId: 1, phoneNumber: 1, status: 1, _id: 0 });
        res.json({ success: true, sessions });
    } catch (err) {
        console.error("Sessions fetch error:", err.message);
        res.json({ success: false, error: err.message });
    }
});

// ✅ DELETE SESSION
app.delete('/sessions/:sessionId', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.json({ success: false, error: "MongoDB not connected" });
    }
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.json({ success: false, error: "Session not found" });
        }

        const sock = activeSockets.get(sessionId);
        if (sock) {
            await sock.logout();
            sock.end();
            activeSockets.delete(sessionId);
        }

        await Session.deleteOne({ sessionId });

        res.json({ success: true, message: "Session deleted" });
    } catch (err) {
        console.error("Delete session error:", err.message);
        res.json({ success: false, error: err.message });
    }
});

// ✅ HEALTH CHECK
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        status: 'healthy',
        connectedSessions: activeSockets.size,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: `${hours}h ${minutes}m ${seconds}s`
    });
});

// ✅ BOT INFO
app.get('/botinfo', (req, res) => {
    res.json({
        success: true,
        botName: config.botName || "INSIDIOUS",
        activeSessions: activeSockets.size,
        uptime: Date.now() - botStartTime
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🚀 Deploy: POST http://localhost:${PORT}/deploy`));
    console.log(fancy(`📋 Sessions: http://localhost:${PORT}/sessions`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 3.0.0 | Year: 2025"));
});

module.exports = app;