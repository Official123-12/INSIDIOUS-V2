const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // ← install: npm install uuid

// ========== GLOBAL ERROR HANDLERS ==========
process.on('uncaughtException', (err) => {
    console.log("⚠️ Uncaught Exception:", err.message);
});
process.on('unhandledRejection', (err) => {
    console.log("⚠️ Unhandled Rejection:", err.message);
});

// ========== FANCY FUNCTION ==========
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

// ========== MONGODB CONNECTION ==========
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch((err) => console.log(fancy("❌ MongoDB Connection FAILED: " + err.message)));

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== CREATE PUBLIC FOLDER IF NOT EXISTS ==========
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ========== SIMPLE ROUTES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ========== LOAD CONFIG ==========
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
        workMode: 'public'
    };
}

// ========== MULTI‑SESSION MANAGEMENT ==========
const sessions = new Map(); // key: phoneNumber (string), value: session object

// Session object structure:
// {
//   phoneNumber: string,
//   conn: WASocket,
//   isConnected: boolean,
//   startTime: Date,
//   sessionDir: string,
//   botName: string,
//   botId: string
// }

// ========== FUNCTION TO START A NEW SESSION ==========
async function startSession(phoneNumber) {
    // Safisha namba
    const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNum.length < 10) throw new Error("Invalid phone number");

    // Kama session tayari ipo, irudishe
    if (sessions.has(cleanNum)) {
        return sessions.get(cleanNum);
    }

    console.log(fancy(`🚀 Starting new session for ${cleanNum}...`));

    const sessionDir = path.join(__dirname, 'sessions', cleanNum);
    fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
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
        markOnlineOnConnect: true
    });

    // Unda session object
    const session = {
        phoneNumber: cleanNum,
        conn,
        isConnected: false,
        startTime: Date.now(),
        sessionDir,
        botName: 'Unknown',
        botId: 'Unknown'
    };
    sessions.set(cleanNum, session);

    // ===== EVENT: connection.update =====
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(fancy(`✅ Session ${cleanNum} is now ONLINE`));
            session.isConnected = true;
            session.botName = conn.user?.name || 'Unknown';
            if (conn.user?.id) {
                session.botId = conn.user.id.split(':')[0];
            }

            // Tuma welcome message kwa owner (kama ni session ya owner)
            setTimeout(async () => {
                try {
                    if (config.ownerNumber && config.ownerNumber.includes(cleanNum)) {
                        const ownerJid = cleanNum + '@s.whatsapp.net';
                        const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${session.botName}
📞 *Number:* ${cleanNum}
🆔 *Bot ID:* ${session.botId}

⚡ *Status:* ONLINE & ACTIVE
📅 *Session started:* ${new Date(session.startTime).toLocaleString()}
`;
                        await conn.sendMessage(ownerJid, {
                            text: welcomeMsg
                        });
                    }
                } catch (e) {}
            }, 3000);
        }

        if (connection === 'close') {
            console.log(fancy(`🔌 Session ${cleanNum} closed`));
            session.isConnected = false;

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log(fancy(`🔄 Reconnecting session ${cleanNum} in 5s...`));
                setTimeout(() => {
                    // Ikiwa session bado ipo kwenye Map, jaribu kuanzisha tena
                    if (sessions.has(cleanNum) && !sessions.get(cleanNum).isConnected) {
                        // Ondoa session ya zamani kwenye Map (ili kuweza kuunda upya)
                        sessions.delete(cleanNum);
                        startSession(cleanNum).catch(err => {
                            console.log(fancy(`❌ Failed to reconnect ${cleanNum}: ${err.message}`));
                        });
                    }
                }, 5000);
            } else {
                console.log(fancy(`🚫 Session ${cleanNum} logged out. Delete folder to reuse.`));
                // Tunaweza kuondoa kwenye Map, lakini tusifute folder moja kwa moja
                sessions.delete(cleanNum);
            }
        }
    });

    // ===== EVENT: creds.update =====
    conn.ev.on('creds.update', saveCreds);

    // ===== EVENT: messages.upsert =====
    conn.ev.on('messages.upsert', async (m) => {
        try {
            const handler = require('./handler');
            if (handler && typeof handler === 'function') {
                await handler(conn, m);
            }
        } catch (error) {
            console.error(`Message handler error (${cleanNum}):`, error.message);
        }
    });

    // ===== EVENT: group-participants.update =====
    conn.ev.on('group-participants.update', async (update) => {
        try {
            const handler = require('./handler');
            if (handler && handler.handleGroupUpdate) {
                await handler.handleGroupUpdate(conn, update);
            }
        } catch (error) {
            console.error(`Group update error (${cleanNum}):`, error.message);
        }
    });

    console.log(fancy(`📱 Session ${cleanNum} initialized, waiting for connection...`));
    return session;
}

// ========== ENDPOINT: /sessions – Orodha ya sessions zote ==========
app.get('/sessions', (req, res) => {
    const sessionList = [];
    for (let [num, sess] of sessions.entries()) {
        sessionList.push({
            phoneNumber: num,
            isConnected: sess.isConnected,
            botName: sess.botName,
            botId: sess.botId,
            uptime: Date.now() - sess.startTime,
            startTime: sess.startTime
        });
    }
    res.json({ success: true, sessions: sessionList });
});

// ========== ENDPOINT: /session/:id – Taarifa za session moja ==========
app.get('/session/:id', (req, res) => {
    const id = req.params.id.replace(/[^0-9]/g, '');
    const sess = sessions.get(id);
    if (!sess) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({
        success: true,
        session: {
            phoneNumber: id,
            isConnected: sess.isConnected,
            botName: sess.botName,
            botId: sess.botId,
            uptime: Date.now() - sess.startTime,
            startTime: sess.startTime
        }
    });
});

// ========== ENDPOINT: /session/:id/logout – Logout session ==========
app.post('/session/:id/logout', async (req, res) => {
    const id = req.params.id.replace(/[^0-9]/g, '');
    const sess = sessions.get(id);
    if (!sess) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    try {
        // Logout kutoka WhatsApp
        if (sess.conn) {
            await sess.conn.logout();
        }
        // Ondoa kwenye Map
        sessions.delete(id);
        // Futa folder ya session (hiari)
        // fs.rmSync(sess.sessionDir, { recursive: true, force: true });
        res.json({ success: true, message: `Session ${id} logged out` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========== ENDPOINT: /pair (8‑digit pairing) – Anzisha session na upate code ==========
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ error: "Provide number! Example: /pair?num=255123456789" });
        }

        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ error: "Invalid number" });
        }

        // Angalia kama session tayari ipo na imeconnected
        let session = sessions.get(cleanNum);
        if (!session) {
            // Anzisha session mpya
            session = await startSession(cleanNum);
        }

        // Subiri kidogo connection iwe tayari (optional)
        if (!session.conn) {
            return res.json({ error: "Session not ready, try again in a few seconds" });
        }

        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));
        const code = await session.conn.requestPairingCode(cleanNum);
        res.json({
            success: true,
            code: code,
            message: `8-digit pairing code: ${code}`
        });

    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ========== ENDPOINT: /unpair (kwa compatibility – sasa inaweza kutumika kufuta session) ==========
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ error: "Provide number! Example: /unpair?num=255123456789" });
        }

        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ error: "Invalid number" });
        }

        const session = sessions.get(cleanNum);
        if (!session) {
            return res.json({ success: true, message: `No active session for ${cleanNum}` });
        }

        await session.conn.logout();
        sessions.delete(cleanNum);
        // Optional: delete folder
        // fs.rmSync(session.sessionDir, { recursive: true, force: true });

        res.json({
            success: true,
            message: `Number ${cleanNum} unpaired successfully`
        });

    } catch (err) {
        console.error("Unpair error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ========== ENDPOINT: /health (global) ==========
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    res.json({
        status: 'healthy',
        totalSessions: sessions.size,
        connectedSessions: Array.from(sessions.values()).filter(s => s.isConnected).length,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ========== KEEP‑ALIVE PING ==========
setInterval(() => {
    fetch(`http://localhost:${PORT}/health`).catch(() => {});
}, 5 * 60 * 1000);

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`📋 Sessions list: http://localhost:${PORT}/sessions`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ | Multi‑Session Ready"));
});

module.exports = app;