const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs-extra');
const crypto = require('crypto');

// ==================== LOAD HANDLER & CONFIG ====================
const handler = require('./handler');
let config = {};
try { config = require('./config'); } catch { config = {}; }

// ==================== FANCY FUNCTION ====================
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
const HOST = '0.0.0.0';

// ==================== GLOBAL STORAGE ====================
const sessions = new Map(); // sessionId -> { conn, phoneNumber, authDir, status }

// ==================== MONGODB (OPTIONAL) ====================
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch(err => console.log(fancy("❌ MongoDB Connection FAILED: " + err.message)));

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== UNHANDLED REJECTION GUARD ====================
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==================== HELPER: GENERATE UNIQUE SESSION ID ====================
function generateSessionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = 'STANY~';
    for (let i = 0; i < 6; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

// ==================== SEND WELCOME MESSAGE WITH SESSION ID ====================
async function sendWelcomeMessage(conn, phoneNumber, sessionId) {
    try {
        const welcomeMsg = fancy(
            `╭━━━━━━━━━━━━━━╮\n` +
            `   🥀 INSIDIOUS BOT\n` +
            `╰━━━━━━━━━━━━━━╯\n\n` +
            `✅ *Pairing successful!*\n\n` +
            `📱 *Your Number:* ${phoneNumber}\n` +
            `🆔 *Your Secret Session ID:* \`${sessionId}\`\n\n` +
            `📌 *How to deploy:*\n` +
            `1. Go to our web dashboard\n` +
            `2. Enter this Session ID\n` +
            `3. Click "Deploy" to activate your bot\n\n` +
            `🔗 *Useful links:*\n` +
            `• Group: ${config.requiredGroupInvite || 'https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y'}\n` +
            `• Channel: ${config.newsletterLink || 'https://whatsapp.com/channel/0029VbB3xYzKjM8vN9pL4R2s'}\n` +
            `• Developer: wa.me/${config.developerNumber || '255787069580'}\n\n` +
            `━━━━━━━━━━━━━━\n` +
            `👑 Developer: ${config.developer || 'STANYTZ'}`
        );
        await conn.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
            image: { url: config.botImage || 'https://files.catbox.moe/mfngio.png' },
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
    } catch (e) {
        console.log(`Welcome message failed for ${phoneNumber}:`, e.message);
    }
}

// ==================== START BOT FOR A SESSION (ACTUALLY DEPLOY) ====================
async function startUserBot(sessionId, phoneNumber) {
    const authDir = path.join(__dirname, 'sessions', sessionId);
    try {
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            maxRetryCount: Infinity, // keep reconnecting forever
            retryRequestDelayMs: 500,
            shouldIgnoreJid: () => true
        });

        sessions.set(sessionId, { conn, phoneNumber, authDir, status: 'connecting' });

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(fancy(`✅ Bot deployed: ${sessionId}`));
                const session = sessions.get(sessionId);
                if (session) session.status = 'active';

                // Optionally send a "bot is now active" message? You can add if you want.
            }
            if (connection === 'close') {
                console.log(fancy(`🔌 Bot disconnected: ${sessionId}`));
                const session = sessions.get(sessionId);
                if (session) session.status = 'disconnected';
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    setTimeout(() => startUserBot(sessionId, phoneNumber), 5000);
                } else {
                    sessions.delete(sessionId);
                    await fs.rm(authDir, { recursive: true, force: true }).catch(() => {});
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', async (m) => {
            try { if (handler) await handler(conn, m, sessionId); } catch {}
        });
        conn.ev.on('group-participants.update', async (up) => {
            try { if (handler?.handleGroupUpdate) await handler.handleGroupUpdate(conn, up, sessionId); } catch {}
        });
        conn.ev.on('call', async (call) => {
            try { if (handler?.handleCall) await handler.handleCall(conn, call, sessionId); } catch {}
        });

        return conn;
    } catch (err) {
        console.error(`Error starting bot for ${sessionId}:`, err);
        sessions.delete(sessionId);
        await fs.rm(authDir, { recursive: true, force: true }).catch(() => {});
        throw err;
    }
}

// ==================== PAIRING ENDPOINT (GET CODE + SESSION ID, NO AUTO-START) ====================
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.status(400).json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) return res.status(400).json({ success: false, error: "Invalid number" });

        // Generate a unique session ID
        const sessionId = generateSessionId();
        console.log(fancy(`🔑 Generating code for ${cleanNum} (session: ${sessionId})`));

        // Create temporary directory for this pairing attempt
        const tempDir = path.join(__dirname, 'temp', sessionId);
        await fs.ensureDir(tempDir);
        const { state } = await useMultiFileAuthState(tempDir);
        const { version } = await fetchLatestBaileysVersion();

        const tempConn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: false,
            maxRetryCount: 2
        });

        const code = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                tempConn.end();
                reject(new Error("⏰ Pairing timeout (60s)"));
            }, 60000);

            tempConn.ev.on('connection.update', async (update) => {
                const { connection } = update;
                if (connection === 'open') {
                    await new Promise(r => setTimeout(r, 1000));
                    try {
                        const pairingCode = await tempConn.requestPairingCode(cleanNum);
                        clearTimeout(timeout);
                        resolve(pairingCode);
                    } catch (err) {
                        reject(err);
                    } finally {
                        setTimeout(() => tempConn.end(), 2000);
                    }
                }
            });
        });

        // Now move the auth folder from temp to permanent sessions
        const permDir = path.join(__dirname, 'sessions', sessionId);
        await fs.move(tempDir, permDir, { overwrite: true });

        // Save metadata (phone number)
        await fs.writeJson(path.join(permDir, 'meta.json'), { phoneNumber: cleanNum, sessionId });

        // Register with handler (if needed)
        if (handler?.pairNumber) {
            await handler.pairNumber(cleanNum, { sessionId }).catch(() => {});
        }

        // Now we need to send a WhatsApp message to the user with the session ID.
        // But we need a connection to send that message. We can use a temporary connection just to send the welcome.
        // However, we already have a temporary socket that is still alive. Let's reuse it.
        try {
            await sendWelcomeMessage(tempConn, cleanNum, sessionId);
        } catch (sendErr) {
            console.log("Failed to send welcome message via temp socket, but pairing succeeded.");
        }

        res.json({
            success: true,
            code: code,
            formattedCode: code.match(/.{1,4}/g)?.join('-') || code,
            sessionId: sessionId,
            message: `✅ 8-digit pairing code: ${code}\nSession ID: ${sessionId}`
        });

        // Do NOT start the bot here – wait for /deploy.

    } catch (err) {
        console.error("Pairing error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== DEPLOY ENDPOINT ====================
app.post('/deploy', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ success: false, error: "Missing sessionId" });

        const session = sessions.get(sessionId);
        if (session && session.status === 'active') {
            return res.json({ success: true, message: "Bot already running", sessionId });
        }

        // Need phone number from metadata
        const metaFile = path.join(__dirname, 'sessions', sessionId, 'meta.json');
        let phoneNumber;
        try {
            const meta = await fs.readJson(metaFile);
            phoneNumber = meta.phoneNumber;
        } catch {
            return res.status(400).json({ success: false, error: "Session not found or metadata missing" });
        }

        await startUserBot(sessionId, phoneNumber);
        res.json({ success: true, message: "Bot deployment started", sessionId });

    } catch (err) {
        console.error("Deploy error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== SESSIONS LIST ====================
app.get('/sessions', (req, res) => {
    const list = [];
    for (const [sid, data] of sessions) {
        list.push({
            sessionId: sid,
            phoneNumber: data.phoneNumber,
            status: data.status,
            connected: data.status === 'active'
        });
    }
    res.json({ success: true, sessions: list, count: list.length });
});

// ==================== DELETE SESSION ====================
app.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessions.get(sessionId);
        if (session && session.conn) {
            session.conn.end();
        }
        sessions.delete(sessionId);
        const authDir = path.join(__dirname, 'sessions', sessionId);
        await fs.rm(authDir, { recursive: true, force: true }).catch(() => {});
        res.json({ success: true, message: `Session ${sessionId} deleted` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    res.json({
        status: 'healthy',
        uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        activeSessions: sessions.size
    });
});

// ==================== BOT INFO ====================
app.get('/botinfo', (req, res) => {
    res.json({
        success: true,
        botName: config.botName || "INSIDIOUS",
        version: config.version || "2.1.1",
        developer: config.developer || "STANYTZ",
        sessions: sessions.size
    });
});

// ==================== SERVE STATIC FILES ====================
app.use(express.static(path.join(__dirname, 'public')));

// ==================== START SERVER ====================
app.listen(PORT, HOST, () => {
    console.log(fancy(`🌐 Web Interface: http://${HOST}:${PORT}`));
    console.log(fancy(`🔗 Pair: http://${HOST}:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`📋 Sessions: http://${HOST}:${PORT}/sessions`));
    console.log(fancy(`❤️ Health: http://${HOST}:${PORT}/health`));
    console.log(fancy(`👑 Developer: ${config.developer || 'STANYTZ'}`));
    console.log(fancy(`✅ Multi-user sessions – bot starts only after /deploy`));
});

// Ensure required folders exist
fs.ensureDirSync(path.join(__dirname, 'sessions'));
fs.ensureDirSync(path.join(__dirname, 'temp'));

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log(fancy("🛑 Shutting down..."));
    for (const [sid, data] of sessions) {
        if (data.conn) await data.conn.end();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(fancy("🛑 Shutting down..."));
    for (const [sid, data] of sessions) {
        if (data.conn) await data.conn.end();
    }
    process.exit(0);
});

module.exports = app;