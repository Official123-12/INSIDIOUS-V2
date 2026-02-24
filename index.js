// ==================== index.js (INSIDIOUS BOT) ====================
require('dotenv').config();
const express = require('express');
const { default: makeWASocket, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== GLOBAL ERROR HANDLERS ====================
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    // Keep the process alive
});
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err.message);
});

// ==================== FANCY LOGGING ====================
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

// ==================== CONFIG ====================
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error(fancy("❌ MONGODB_URI environment variable is required"));
    process.exit(1);
}

// Optional bot config
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("⚠️ No config file, using defaults"));
    config = {
        prefix: '.',
        ownerNumber: [],
        botName: 'INSIDIOUS',
        workMode: 'public',
        botImage: 'https://files.catbox.moe/f3c07u.jpg',
        newsletterJid: "120363404317544295@newsletter"
    };
}

// ==================== MONGOOSE MODELS ====================
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

// ==================== MONGO AUTH STATE ====================
async function useMongoAuthState(sessionId) {
    let session = await Session.findOne({ sessionId });
    if (!session) {
        session = new Session({ sessionId, creds: null, keys: null, status: 'pending' });
        await session.save();
    }
    return {
        state: {
            creds: session.creds || { registered: false, deviceId: Math.floor(Math.random() * 10000) },
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
const activeSockets = new Map();

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
            console.log(fancy(`✅ Socket ${sessionId} open`));
            if (socket.user?.id) {
                const phoneNumber = socket.user.id.split(':')[0];
                await Session.updateOne({ sessionId }, { phoneNumber });
                await sendWelcomeMessage(socket, sessionId, phoneNumber);
            }
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => {
                    activeSockets.delete(sessionId);
                    startSocket(sessionId);
                }, 5000);
            } else {
                await Session.updateOne({ sessionId }, { status: 'expired' });
                activeSockets.delete(sessionId);
            }
        }
    });

    // Attach handler
    const handler = require('./handler');
    socket.ev.on('messages.upsert', async (m) => {
        try { if (handler && typeof handler === 'function') await handler(socket, m); }
        catch (err) { console.error(`Handler error ${sessionId}:`, err.message); }
    });
    socket.ev.on('group-participants.update', async (update) => {
        try { if (handler?.handleGroupUpdate) await handler.handleGroupUpdate(socket, update); }
        catch (err) { console.error(`Group update error ${sessionId}:`, err.message); }
    });
    socket.ev.on('call', async (call) => {
        try { if (handler?.handleCall) await handler.handleCall(socket, call); }
        catch (err) { console.error(`Call handler error ${sessionId}:`, err.message); }
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

// ==================== WELCOME MESSAGE ====================
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

📋 *Copy this Session ID* (tap and hold) and use it on the website to deploy.

👑 *Developer:* STANYTZ
👉 ${process.env.BASE_URL || 'https://your-app.railway.app'}
`;
        await socket.sendMessage(jid, {
            image: { url: config.botImage || "https://files.catbox.moe/f3c07u.jpg" },
            caption: welcomeMsg,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.newsletterJid,
                    newsletterName: config.botName
                }
            }
        });
        console.log(fancy(`📨 Welcome message sent to ${phoneNumber}`));
    } catch (err) {
        console.error(fancy(`❌ Failed to send welcome: ${err.message}`));
    }
}

// ==================== EXPRESS APP ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== HEALTH CHECK (fast) ====================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        server: 'running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        activeSessions: activeSockets.size
    });
});

// ==================== API ROUTES ====================
app.get('/pair', async (req, res) => {
    try {
        const phoneNumber = req.query.num?.replace(/[^0-9]/g, '');
        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            return res.status(400).json({ success: false, error: 'Invalid phone number.' });
        }
        const sessionId = `STANY~${randomMegaId()}`;
        const socket = await startSocket(sessionId);
        const code = await socket.requestPairingCode(phoneNumber);
        res.json({ success: true, code, sessionId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({ status: 'active' }).select('sessionId phoneNumber status createdAt').lean();
        res.json({ success: true, sessions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        await stopSocket(sessionId);
        await Session.deleteOne({ sessionId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/deploy', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        if (!activeSockets.has(sessionId)) await startSocket(sessionId);
        res.json({ success: true, message: 'Bot deployed' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/settings', async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await Setting.updateOne({ key }, { value }, { upsert: true });
        }
        res.json({ success: true });
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== UTILITY ====================
function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

async function restoreSessions() {
    const activeSessions = await Session.find({ status: 'active' });
    console.log(fancy(`🔄 Restoring ${activeSessions.length} active sessions...`));
    for (const session of activeSessions) {
        try { await startSocket(session.sessionId); } 
        catch (err) { console.error(fancy(`❌ Failed to restore ${session.sessionId}:`), err.message); }
    }
}

// ==================== START SERVER FIRST ====================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(fancy(`🌐 Server listening on port ${PORT}`));
});

// ==================== THEN CONNECT TO MONGODB ====================
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
}).then(() => {
    console.log(fancy("✅ MongoDB Connected"));
    restoreSessions(); // run in background
}).catch(err => {
    console.error(fancy("❌ MongoDB Connection FAILED:"), err.message);
    // Keep server running even without DB
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
    console.log(fancy('🛑 SIGTERM received, closing all sockets...'));
    server.close(() => {
        for (const { socket } of activeSockets.values()) socket?.end(undefined);
        mongoose.connection.close();
    });
});

module.exports = app;