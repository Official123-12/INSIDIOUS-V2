// ==================== index.js (INSIDIOUS BOT) ====================
// Original style – updated with multi‑session, MongoDB, and health check fix
// Developer: STANYTZ | Version: 2.2.1

require('dotenv').config();
const express = require('express');
const { default: makeWASocket, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

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
    console.error(fancy("❌ MONGODB_URI environment variable is required!"));
    process.exit(1); // Exit because the user wants DB connected
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
const activeSockets = new Map(); // sessionId -> { socket, saveCreds }

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

    // Attach your message handler (imported from './handler')
    const handler = require('./handler');
    socket.ev.on('messages.upsert', async (m) => {
        try {
            if (handler && typeof handler === 'function') {
                await handler(socket, m);
            }
        } catch (err) {
            console.error(`Handler error for ${sessionId}:`, err.message);
        }
    });

    socket.ev.on('group-participants.update', async (update) => {
        try {
            if (handler && handler.handleGroupUpdate) {
                await handler.handleGroupUpdate(socket, update);
            }
        } catch (err) {
            console.error(`Group update error for ${sessionId}:`, err.message);
        }
    });

    socket.ev.on('call', async (call) => {
        try {
            if (handler && handler.handleCall) {
                await handler.handleCall(socket, call);
            }
        } catch (err) {
            console.error(`Call handler error for ${sessionId}:`, err.message);
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

// ==================== WELCOME MESSAGE (with Session ID) ====================
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
📞 *Your Number:* ${phoneNumber}

📋 *How to copy this Session ID:*
• On Android/iOS: *Tap and hold* on the code above, then select *Copy*.
• Then go to the INSIDIOUS website, paste it in the *Deploy* section and click *Deploy*.

⚡ *Status:* ONLINE & ACTIVE

📊 *ALL FEATURES ACTIVE:*
🛡️ Anti View Once: ✅
🗑️ Anti Delete: ✅
🤖 AI Chatbot: ✅
⚡ Auto Typing: ✅
📼 Auto Recording: ✅
👀 Auto Read: ✅
❤️ Auto React: ✅
🎉 Welcome/Goodbye: ✅

👑 *Developer:* STANYTZ
💾 *Version:* 2.2.1 | Multi-session

👉 *Deploy now:* ${process.env.BASE_URL || 'https://your-app.railway.app'}
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
        console.log(fancy(`📨 Welcome message sent to ${phoneNumber}`));
    } catch (err) {
        console.error(fancy(`❌ Failed to send welcome message to ${phoneNumber}:`), err.message);
    }
}

// ==================== EXPRESS APP ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend

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
// Pair a new number – returns 8-digit code and sessionId
app.get('/pair', async (req, res) => {
    try {
        const phoneNumber = req.query.num?.replace(/[^0-9]/g, '');
        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            return res.status(400).json({ success: false, error: 'Invalid phone number. Must be 10-15 digits.' });
        }

        // Generate unique session ID
        const sessionId = `STANY~${randomMegaId()}`;

        // Start a socket for this session (creates pending session in DB)
        const socket = await startSocket(sessionId);

        // Request 8-digit pairing code
        const code = await socket.requestPairingCode(phoneNumber);

        // Return both code and sessionId
        res.json({
            success: true,
            code,
            sessionId,
            message: 'Pairing code generated. After entering it in WhatsApp, you will receive a welcome message with your Session ID.'
        });

    } catch (err) {
        console.error('Pairing error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// List all active sessions
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

// Delete a session
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

// Deploy (activate) a session – ensures socket is running
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

// Save settings (multiple toggles)
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

// Get current settings
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

// Catch-all: serve frontend (for SPA routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// ==================== START SERVER & CONNECT TO MONGODB ====================
// Start server immediately so health check passes
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(fancy(`🌐 Server listening on port ${PORT}`));
});

// Then connect to MongoDB (if URI provided)
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
}).then(() => {
    console.log(fancy("✅ MongoDB Connected"));
    restoreSessions(); // run in background
}).catch(err => {
    console.error(fancy("❌ MongoDB Connection FAILED:"), err.message);
    process.exit(1); // Exit because DB is required
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