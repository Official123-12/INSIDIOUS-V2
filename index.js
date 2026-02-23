const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER ====================
const handler = require('./handler');

// ==================== MODELS & UTILS ====================
const Session = require('./models/Session');
const useMongoAuthState = require('./utils/mongoAuth');

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
    } catch (e) {
        return text;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => {
    console.log(fancy("✅ MongoDB Connected"));
    // Load all saved sessions after DB connects
    loadAllSessions();
})
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
    process.exit(1);
});

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ✅ **GLOBAL VARIABLES FOR MULTI‑SESSION**
const activeConnections = new Map(); // key: phoneNumber, value: { sock, saveCreds, keyData }
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

// ==================== MULTI‑SESSION MANAGEMENT ====================

async function startUserBot(phoneNumber) {
    if (activeConnections.has(phoneNumber)) {
        return activeConnections.get(phoneNumber).sock;
    }

    console.log(fancy(`🚀 Starting bot for ${phoneNumber}...`));

    const { state, saveCreds, keyData } = await useMongoAuthState(phoneNumber);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
        },
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Safari'),
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: true
    });

    activeConnections.set(phoneNumber, { sock, saveCreds, keyData });

    // ---------- CREDENTIALS UPDATE ----------
    sock.ev.on('creds.update', async () => {
        const fullCreds = sock.authState.creds;
        const entry = activeConnections.get(phoneNumber);
        if (entry && entry.keyData) {
            await Session.findOneAndUpdate(
                { phoneNumber },
                { $set: { creds: fullCreds, keys: entry.keyData } },
                { upsert: true, new: true }
            );
            console.log(fancy(`💾 Saved session for ${phoneNumber}`));
        }
    });

    // ---------- CONNECTION UPDATE ----------
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(fancy(`✅ ${phoneNumber} is now online`));
            // Send welcome message if this is the owner
            if (config.ownerNumber && config.ownerNumber.includes(phoneNumber)) {
                sendWelcomeMessage(sock, phoneNumber);
            }
        }

        if (connection === 'close') {
            console.log(fancy(`🔌 Connection closed for ${phoneNumber}`));
            activeConnections.delete(phoneNumber);

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log(fancy(`🔄 Reconnecting ${phoneNumber} in 5 seconds...`));
                setTimeout(() => startUserBot(phoneNumber), 5000);
            } else {
                console.log(fancy(`🚫 ${phoneNumber} logged out.`));
                // Optionally delete session from DB
                // await Session.deleteOne({ phoneNumber });
            }
        }
    });

    // ---------- MESSAGES ----------
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (handler && typeof handler === 'function') {
                await handler(sock, m);
            }
        } catch (error) {
            console.error(`Message handler error for ${phoneNumber}:`, error.message);
        }
    });

    // ---------- GROUP PARTICIPANTS ----------
    sock.ev.on('group-participants.update', async (update) => {
        try {
            if (handler && handler.handleGroupUpdate) {
                await handler.handleGroupUpdate(sock, update);
            }
        } catch (error) {
            console.error(`Group update error for ${phoneNumber}:`, error.message);
        }
    });

    // ---------- CALLS ----------
    sock.ev.on('call', async (call) => {
        try {
            if (handler && handler.handleCall) {
                await handler.handleCall(sock, call);
            }
        } catch (error) {
            console.error(`Call handler error for ${phoneNumber}:`, error.message);
        }
    });

    return sock;
}

// Helper to send welcome message to owner
async function sendWelcomeMessage(sock, phoneNumber) {
    setTimeout(async () => {
        try {
            const ownerJid = phoneNumber + '@s.whatsapp.net';
            const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
            const pairedCount = activeConnections.size;

            const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${sock.user?.name || 'INSIDIOUS'}
📞 *Number:* ${phoneNumber}
🆔 *Bot ID:* ${botSecret}
👥 *Paired Owners:* ${pairedCount}

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

🔧 *Commands:* All working
📁 *Database:* Connected
🚀 *Performance:* Optimal

👑 *Developer:* STANYTZ
💾 *Version:* 2.1.1 | Year: 2025`;

            await sock.sendMessage(ownerJid, {
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
            console.log(fancy(`✅ Welcome message sent to ${phoneNumber}`));
        } catch (e) {
            console.log(fancy(`⚠️ Could not send welcome message to ${phoneNumber}:`), e.message);
        }
    }, 3000);
}

// Load all saved sessions from MongoDB
async function loadAllSessions() {
    try {
        const sessions = await Session.find({});
        console.log(fancy(`📂 Found ${sessions.length} saved session(s). Starting bots...`));
        for (const session of sessions) {
            startUserBot(session.phoneNumber).catch(err => {
                console.error(`Failed to start bot for ${session.phoneNumber}:`, err.message);
            });
        }
    } catch (err) {
        console.error('Error loading sessions:', err.message);
    }
}

// ==================== HTTP ENDPOINTS ====================

// ✅ **PAIRING ENDPOINT**
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

        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));

        const sock = await startUserBot(cleanNum);

        // If already registered, don't request code again
        if (sock.authState.creds && sock.authState.creds.registered) {
            return res.json({ success: true, message: "Number already paired and connected." });
        }

        const code = await Promise.race([
            sock.requestPairingCode(cleanNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout - no response from WhatsApp')), 30000))
        ]);

        res.json({
            success: true,
            code: code,
            message: `8-digit pairing code: ${code}`
        });

    } catch (err) {
        console.error("Pairing error:", err.message);
        if (err.message.includes("already paired")) {
            res.json({ success: true, message: "Number already paired" });
        } else {
            res.json({ success: false, error: "Failed: " + err.message });
        }
    }
});

// ✅ **UNPAIR ENDPOINT**
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

        // Close the connection if active
        if (activeConnections.has(cleanNum)) {
            const { sock } = activeConnections.get(cleanNum);
            sock.end(new Error('Unpaired by user'));
            activeConnections.delete(cleanNum);
        }

        // Remove from database
        const result = await Session.deleteOne({ phoneNumber: cleanNum });

        res.json({
            success: result.deletedCount > 0,
            message: result.deletedCount > 0 ? `Number ${cleanNum} unpaired successfully` : `No session found for ${cleanNum}`
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
        activeConnections: activeConnections.size,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ✅ **BOT INFO ENDPOINT**
app.get('/botinfo', (req, res) => {
    const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
    const activeNumbers = Array.from(activeConnections.keys());

    res.json({
        success: true,
        botSecret: botSecret,
        activeConnections: activeNumbers.length,
        numbers: activeNumbers,
        uptime: Date.now() - botStartTime
    });
});

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
});

module.exports = app;