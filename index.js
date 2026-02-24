// ==================== index.js (INSIDIOUS BOT) ====================
// Original style – updated with multi‑session + WhatsApp session ID
// All fixes applied – ready for Railway deployment
// Developer: STANYTZ | Version: 2.2.2

const express = require('express');
const { default: makeWASocket, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER ====================
const handler = require('./handler');

// ✅ **FANCY FUNCTION** (unchanged)
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
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
        result += fancyMap[text[i]] || text[i];
    }
    return result;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION**
console.log(fancy("🔗 Preparing MongoDB connection..."));
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error(fancy("❌ MONGODB_URI environment variable is required!"));
    process.exit(1);
}

// ✅ **MONGOOSE MODELS**
const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    phoneNumber: String,
    creds: mongoose.Schema.Types.Mixed,
    keys: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ['pending', 'active', 'expired'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
const Session = mongoose.model('Session', SessionSchema);

const SettingSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: mongoose.Schema.Types.Mixed
});
const Setting = mongoose.model('Setting', SettingSchema);

// ✅ **MIDDLEWARE**
app.use(express.json());

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS – FIXES THE "CANNOT READ PROPERTIES OF UNDEFINED" ERROR**
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log(fancy("📁 Created public folder"));
}
app.use(express.static(publicDir));

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

// ✅ **GLOBAL VARIABLES – Multi-session map**
const activeSockets = new Map(); // sessionId -> { socket, saveCreds }
let botStartTime = Date.now();

// ✅ **LOAD CONFIG** (unchanged)
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("⚠️ No config file, using defaults"));
    config = {
        prefix: '.',
        ownerNumber: ['255000000000'],
        botName: 'INSIDIOUS',
        workMode: 'public',
        botImage: 'https://files.catbox.moe/f3c07u.jpg',
        newsletterJid: "120363404317544295@newsletter"
    };
}

// ==================== MONGO AUTH STATE ====================
async function useMongoAuthState(sessionId) {
    let session = await Session.findOne({ sessionId });
    if (!session) {
        session = new Session({
            sessionId,
            creds: null,
            keys: null,
            status: 'pending'
        });
        await session.save();
    }
    return {
        state: {
            creds: session.creds || {
                registered: false,
                deviceId: Math.floor(Math.random() * 10000),
            },
            keys: session.keys || {}
        },
        saveCreds: async () => {
            await Session.updateOne(
                { sessionId },
                { creds: session.creds, keys: session.keys, status: 'active' }
            );
        }
    };
}

// ==================== SESSION MANAGER ====================
async function startSocket(sessionId) {
    if (activeSockets.has(sessionId)) {
        return activeSockets.get(sessionId).socket;
    }

    const { state, saveCreds } = await useMongoAuthState(sessionId);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
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

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(fancy(`✅ Socket ${sessionId} is now open`));
            if (socket.user?.id) {
                const phoneNumber = socket.user.id.split(':')[0];
                await Session.updateOne({ sessionId }, { phoneNumber });
                await sendWelcomeMessage(socket, sessionId, phoneNumber);
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(fancy(`🔄 Reconnecting ${sessionId} in 5 seconds...`));
                setTimeout(() => {
                    activeSockets.delete(sessionId);
                    startSocket(sessionId);
                }, 5000);
            } else {
                console.log(fancy(`🚫 Session ${sessionId} logged out`));
                await Session.updateOne({ sessionId }, { status: 'expired' });
                activeSockets.delete(sessionId);
            }
        }
    });

    // ✅ **MESSAGE HANDLER** (unchanged)
    socket.ev.on('messages.upsert', async (m) => {
        try {
            if (handler && typeof handler === 'function') {
                await handler(socket, m);
            }
        } catch (error) {
            console.error("Message handler error:", error.message);
        }
    });

    // ✅ **GROUP UPDATE HANDLER** (unchanged)
    socket.ev.on('group-participants.update', async (update) => {
        try {
            if (handler && handler.handleGroupUpdate) {
                await handler.handleGroupUpdate(socket, update);
            }
        } catch (error) {
            console.error("Group update error:", error.message);
        }
    });

    // ✅ **CALL HANDLER** (unchanged)
    socket.ev.on('call', async (call) => {
        try {
            if (handler && handler.handleCall) {
                await handler.handleCall(socket, call);
            }
        } catch (error) {
            console.error("Call handler error:", error.message);
        }
    });

    activeSockets.set(sessionId, { socket, saveCreds });
    return socket;
}

async function stopSocket(sessionId) {
    if (activeSockets.has(sessionId)) {
        const { socket } = activeSockets.get(sessionId);
        socket?.end(undefined);
        socket?.ev.removeAllListeners();
        activeSockets.delete(sessionId);
    }
}

// ==================== WELCOME MESSAGE (with Session ID - tap & hold to copy) ====================
async function sendWelcomeMessage(socket, sessionId, phoneNumber) {
    try {
        const jid = phoneNumber + '@s.whatsapp.net';
        const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*

🔑 *YOUR SESSION ID:*
\`\`\`
${sessionId}
\`\`\`
📞 *Number:* ${phoneNumber}

📋 *How to copy:*
• *Tap and hold* on the code above → select *Copy*
• Then go to INSIDIOUS website and paste it in *Deploy*

⚡ *Status:* ONLINE & ACTIVE
👑 *Developer:* STANYTZ
💾 *Version:* 2.2.2 | Multi-session

👉 ${process.env.BASE_URL || 'https://your-app.railway.app'}
`;

        await socket.sendMessage(jid, {
            image: { url: config.botImage || "https://files.catbox.moe/f3c07u.jpg" },
            caption: welcomeMsg,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.newsletterJid || "120363404317544295@newsletter",
                    newsletterName: config.botName || "INSIDIOUS BOT"
                }
            }
        });
        console.log(fancy(`📨 Welcome message sent to ${phoneNumber} with Session ID: ${sessionId}`));
    } catch (err) {
        console.error(fancy(`❌ Failed to send welcome message: ${err.message}`));
    }
}

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        server: 'running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        activeSessions: activeSockets.size
    });
});

// ✅ **PAIRING ENDPOINT** – Anarudisha code + sessionId
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }
        
        // ✅ Generate unique session ID kwa kila user
        const sessionId = `STANY~${randomMegaId()}`;
        
        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum} with session ${sessionId}`));
        
        const socket = await startSocket(sessionId);
        const code = await socket.requestPairingCode(cleanNum);
        
        res.json({ 
            success: true, 
            code: code,
            sessionId: sessionId,
            message: `8-digit pairing code: ${code}`
        });
        
    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ **UNPAIR ENDPOINT** (unchanged)
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /unpair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number" });
        }
        
        let result = false;
        if (handler && handler.unpairNumber) {
            result = await handler.unpairNumber(cleanNum);
        } else {
            return res.json({ success: false, error: "Unpair function not available in handler" });
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

// ✅ **SESSIONS ENDPOINT** – List all active sessions
app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({ status: 'active' })
            .select('sessionId phoneNumber status createdAt')
            .lean();
        res.json({ success: true, sessions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ **DELETE SESSION** – Remove from DB and stop socket
app.delete('/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        await stopSocket(sessionId);
        await Session.deleteOne({ sessionId });
        res.json({ success: true, message: 'Session deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ **DEPLOY ENDPOINT** – User anapaste session ID na bot inawaka
app.post('/deploy', async (req, res) => {
    try {
        const { sessionId, number } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'sessionId required' });
        }

        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        if (!activeSockets.has(sessionId)) {
            await startSocket(sessionId);
        }

        res.json({ success: true, message: 'Bot deployed and active' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ **SETTINGS ENDPOINTS**
app.post('/settings', async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await Setting.updateOne({ key }, { value }, { upsert: true });
        }
        res.json({ success: true, message: 'Settings saved' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/settings', async (req, res) => {
    try {
        const settings = await Setting.find().lean();
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json({ success: true, settings: obj });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ **BOT INFO ENDPOINT** (updated)
app.get('/botinfo', (req, res) => {
    if (activeSockets.size === 0) {
        return res.json({ 
            success: false,
            error: "No active bot sessions",
            connected: false
        });
    }
    
    res.json({
        success: true,
        activeSessions: activeSockets.size,
        botName: config.botName,
        connected: true,
        uptime: Date.now() - botStartTime
    });
});

// ==================== UTILITY FUNCTIONS ====================
function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

// ==================== RESTORE SESSIONS ON START ====================
async function restoreSessions() {
    const activeSessions = await Session.find({ status: 'active' });
    console.log(fancy(`🔄 Restoring ${activeSessions.length} active sessions...`));
    for (const session of activeSessions) {
        try {
            await startSocket(session.sessionId);
        } catch (err) {
            console.error(fancy(`❌ Failed to restore session ${session.sessionId}:`), err.message);
        }
    }
}

// ==================== START SERVER FIRST (so health check passes) ====================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(fancy(`🌐 Server listening on port ${PORT}`));
    console.log(fancy(`📁 Public folder: ${publicDir}`));
    console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`📋 Sessions: http://localhost:${PORT}/sessions`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.2.2 | Multi-session + WhatsApp Session ID"));
});

// ==================== THEN CONNECT TO MONGODB ====================
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
}).then(() => {
    console.log(fancy("✅ MongoDB Connected"));
    restoreSessions(); // Restore active sessions after DB connects
}).catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
    process.exit(1);
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
    console.log(fancy('🛑 SIGTERM received, closing all sockets...'));
    server.close(() => {
        for (const [sessionId, { socket }] of activeSockets) {
            socket?.end(undefined);
        }
        mongoose.connection.close();
    });
});

module.exports = app;