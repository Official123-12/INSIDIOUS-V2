const express = require('express');
const { default: makeWASocket, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs-extra');

// ==================== HANDLER ====================
const handler = require('./handler');

// ==================== MODELS & HELPERS ====================
const Session = require('./models/Session');
const useMongoAuthState = require('./lib/mongoAuth');

// ✅ **FANCY FUNCTION**
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
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch(err => console.log(fancy("❌ MongoDB Connection FAILED: " + err.message)));

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

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
/** @type {Map<string, { socket: any, saveCreds: function, startTime: number }>} */
const activeSessions = new Map();

/**
 * Start a WhatsApp client for a specific phone number.
 * @param {string} phoneNumber - e.g. "255712345678"
 * @returns {Promise<any>} the socket
 */
async function startSocket(phoneNumber) {
    console.log(fancy(`🚀 Starting session for ${phoneNumber}`));

    const { state, saveCreds } = await useMongoAuthState(phoneNumber);
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

    activeSessions.set(phoneNumber, {
        socket,
        saveCreds,
        startTime: Date.now()
    });

    // ---- Connection Events ----
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(fancy(`✅ ${phoneNumber} is now online`));

            // Optionally send welcome message to owner numbers
            if (config.ownerNumber.includes(phoneNumber)) {
                setTimeout(async () => {
                    try {
                        const botName = socket.user?.name || "INSIDIOUS";
                        const botNumber = socket.user?.id?.split(':')[0] || phoneNumber;
                        const botId = socket.user?.id || "Unknown";
                        
                        const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
                        
                        const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🆔 *Bot ID:* ${botId}
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

                        await socket.sendMessage(phoneNumber + '@s.whatsapp.net', { 
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
                        console.log(fancy(`✅ Welcome message sent to owner ${phoneNumber}`));
                    } catch (e) {
                        console.log(fancy(`⚠️ Could not send welcome message to ${phoneNumber}: ${e.message}`));
                    }
                }, 3000);
            }
        }

        if (connection === 'close') {
            console.log(fancy(`🔌 Connection closed for ${phoneNumber}`));
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log(fancy(`🔄 Restarting session for ${phoneNumber} in 5 seconds...`));
                setTimeout(() => {
                    startSocket(phoneNumber);
                }, 5000);
            } else {
                console.log(fancy(`🚫 Logged out for ${phoneNumber}. Removing session.`));
                activeSessions.delete(phoneNumber);
                // Optionally delete from DB to force re-pair next time
                // await Session.findByIdAndDelete(phoneNumber);
            }
        }
    });

    socket.ev.on('creds.update', saveCreds);

    // ---- Message Handler ----
    socket.ev.on('messages.upsert', async (m) => {
        try {
            if (handler && typeof handler === 'function') {
                await handler(socket, m);
            }
        } catch (error) {
            console.error(`Message handler error for ${phoneNumber}:`, error.message);
        }
    });

    // ---- Group Updates ----
    socket.ev.on('group-participants.update', async (update) => {
        try {
            if (handler && handler.handleGroupUpdate) {
                await handler.handleGroupUpdate(socket, update);
            }
        } catch (error) {
            console.error(`Group update error for ${phoneNumber}:`, error.message);
        }
    });

    // ---- Call Handler ----
    socket.ev.on('call', async (call) => {
        try {
            if (handler && handler.handleCall) {
                await handler.handleCall(socket, call);
            }
        } catch (error) {
            console.error(`Call handler error for ${phoneNumber}:`, error.message);
        }
    });

    return socket;
}

/**
 * Load all existing sessions from MongoDB and start them.
 */
async function loadAllSessions() {
    const sessions = await Session.find({});
    console.log(fancy(`📂 Found ${sessions.length} saved sessions`));
    for (const sess of sessions) {
        startSocket(sess._id).catch(err => {
            console.error(fancy(`❌ Failed to start session for ${sess._id}: ${err.message}`));
        });
    }
}

// Start all saved sessions after DB is connected
mongoose.connection.once('open', () => {
    loadAllSessions();
});

// ==================== HTTP ENDPOINTS ====================

// ✅ **PAIRING ENDPOINT (8-DIGIT CODE)**
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

        // If a session already exists, return error (or you could reuse it)
        if (activeSessions.has(cleanNum)) {
            return res.json({ success: false, error: "A session for this number already exists." });
        }

        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));

        // Create a temporary socket with empty credentials
        const { state, saveCreds } = await useMongoAuthState(cleanNum); // creates blank session
        const { version } = await fetchLatestBaileysVersion();

        const tempSocket = makeWASocket({
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

        // Save creds when they update
        tempSocket.ev.on('creds.update', saveCreds);

        // Request the pairing code
        const code = await Promise.race([
            tempSocket.requestPairingCode(cleanNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout - no response from WhatsApp')), 30000))
        ]);

        // Send code to client immediately
        res.json({
            success: true,
            code: code,
            message: `8-digit pairing code: ${code}`
        });

        // When the socket connects, add it to active sessions and attach all handlers
        tempSocket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(fancy(`✅ Successfully paired ${cleanNum}`));
                
                // Replace the temporary socket with a fully managed one
                tempSocket.end(undefined);
                
                // Start the permanent session
                await startSocket(cleanNum);
            } else if (connection === 'close') {
                // If pairing fails (e.g., user didn't complete), clean up the blank session
                const error = update.lastDisconnect?.error;
                if (error && !error.message?.includes('already paired')) {
                    console.log(fancy(`❌ Pairing failed for ${cleanNum}`));
                    await Session.findByIdAndDelete(cleanNum);
                }
            }
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

        // Close the socket if active
        const session = activeSessions.get(cleanNum);
        if (session) {
            session.socket.end(undefined);
            activeSessions.delete(cleanNum);
        }

        // Remove from database
        await Session.findByIdAndDelete(cleanNum);

        res.json({ success: true, message: `Number ${cleanNum} unpaired successfully` });

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
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: `${hours}h ${minutes}m ${seconds}s`
    });
});

// ✅ **BOT INFO ENDPOINT** (list all active sessions)
app.get('/botinfo', (req, res) => {
    const sessionsInfo = [];
    for (let [phone, data] of activeSessions.entries()) {
        sessionsInfo.push({
            phone,
            connected: !!data.socket.user,
            uptime: Date.now() - data.startTime
        });
    }

    res.json({
        success: true,
        activeSessions: sessionsInfo,
        total: sessionsInfo.length
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