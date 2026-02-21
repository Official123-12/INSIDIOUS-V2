const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason, 
    delay 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const { Session } = require('./database/models'); // Ensure your model matches
const handler = require('./handler');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ FANCY FUNCTION (Original)
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

// ✅ CONFIG DEFAULTS
let config = {
    prefix: '.',
    ownerNumber: ['255000000000'],
    botName: 'INSIDIOUS',
    botImage: 'https://files.catbox.moe/f3c07u.jpg'
};
try { config = require('./config'); } catch (e) { console.log("Config using defaults"); }

// ✅ MONGODB CONNECTION
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 })
.then(async () => {
    console.log(fancy("✅ MongoDB Connected"));
    await restoreAllSessions(); // 🔥 AUTO-RESTORE ON STARTUP
})
.catch(err => console.log("MongoDB Error: " + err.message));

app.use(express.json());

// ==================== CORE BOT LOGIC ====================

const activeSockets = {}; 

async function startBot(sessionId, savedCreds = null) {
    try {
        const sessionPath = path.join(__dirname, 'sessions', sessionId);
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

        // Force write creds from MongoDB to Railway's disk
        if (savedCreds) {
            fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(savedCreds));
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
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
            markOnlineOnConnect: true
        });

        activeSockets[sessionId] = conn;

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(fancy(`✅ Bot Active: ${sessionId}`));
                await Session.findOneAndUpdate({ sessionId }, { isActive: true }, { upsert: true });

                if (handler && typeof handler.init === 'function') await handler.init(conn);

                // Send Welcome to Owner
                try {
                    const ownerJid = config.ownerNumber[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        image: { url: config.botImage },
                        caption: fancy(`✅ INSIDIOUS ONLINE\n📞 Number: ${conn.user.id.split(':')[0]}`)
                    });
                } catch (e) {}
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                delete activeSockets[sessionId];
                if (reason === DisconnectReason.loggedOut) {
                    await Session.deleteOne({ sessionId });
                    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
                }
            }
        });

        conn.ev.on('creds.update', async () => {
            await saveCreds();
            const currentCreds = JSON.parse(fs.readFileSync(path.join(sessionPath, 'creds.json')));
            await Session.findOneAndUpdate({ sessionId }, { creds: currentCreds, isActive: true }, { upsert: true });
        });

        conn.ev.on('messages.upsert', async (m) => { if (handler) await handler(conn, m); });
        conn.ev.on('group-participants.update', async (u) => { if (handler?.handleGroupUpdate) await handler.handleGroupUpdate(conn, u); });
        conn.ev.on('call', async (c) => { if (handler?.handleCall) await handler.handleCall(conn, c); });

    } catch (e) { console.log(`Error in session ${sessionId}: ${e.message}`); }
}

// 🔥 RESTORE ALL SESSIONS FROM DATABASE
async function restoreAllSessions() {
    try {
        const activeSessions = await Session.find({ isActive: true });
        console.log(fancy(`📂 Restoring ${activeSessions.length} sessions...`));
        for (const s of activeSessions) {
            await startBot(s.sessionId, s.creds);
            await delay(5000); // Prevent CPU overload
        }
    } catch (e) { console.log("Restore error: " + e.message); }
}

// ==================== PAIRING (FIXED "CONNECTION CLOSED") ====================

app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.json({ error: "Please provide a phone number." });

    const cleanNum = num.replace(/[^0-9]/g, '');
    const tempId = `pair_${cleanNum}_${Date.now()}`;
    const tempPath = path.join(__dirname, 'sessions', tempId);
    if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });

    try {
        const { state, saveCreds } = await useMultiFileAuthState(tempPath);
        const { version } = await fetchLatestBaileysVersion();

        const tempConn = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari")
        });

        // 🔥 FIX: Stability delay before requesting code
        setTimeout(async () => {
            try {
                const code = await tempConn.requestPairingCode(cleanNum);
                if (!res.headersSent) res.json({ success: true, code });
            } catch (err) {
                if (!res.headersSent) res.json({ error: "Service busy. Try again in 10s." });
            }
        }, 10000); 

        tempConn.ev.on('creds.update', saveCreds);
        tempConn.ev.on('connection.update', async ({ connection }) => {
            if (connection === 'open') {
                const finalId = tempConn.user.id.split(':')[0];
                const creds = JSON.parse(fs.readFileSync(path.join(tempPath, 'creds.json')));
                await Session.findOneAndUpdate({ sessionId: finalId }, { creds, isActive: true }, { upsert: true });
                startBot(finalId, creds); // Convert temp to permanent
                setTimeout(() => { if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true }); }, 5000);
            }
        });

    } catch (e) { if (!res.headersSent) res.json({ error: e.message }); }
});

// ==================== WEB SERVER START ====================

app.get('/', (req, res) => res.send("INSIDIOUS MULTI-DEVICE MANAGER RUNNING"));

app.listen(PORT, '0.0.0.0', () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy("👑 Developer: STANYTZ"));
});

module.exports = app;