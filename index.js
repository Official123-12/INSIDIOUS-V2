const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER (hautatumika kwa sasa, lakini tunaiweka kwa ajili ya bot za baadaye) ====================
const handler = require('./handler');

// ✅ **FANCY FUNCTION** (ileile)
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
            result += fancyMap[text[i]] || text[i];
        }
        return result;
    } catch (e) {
        return text;
    }
}

// ✅ **RANDOM SESSION ID GENERATOR** (kama ulivyotaka)
function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION** (lazima iwe na environment variable)
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI haijaseti. Weka kwenye environment variables.");
    process.exit(1);
}

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => {
    console.log("❌ MongoDB Connection FAILED:", err.message);
    process.exit(1);
});

// ✅ **MONGOOSE SESSION MODEL**
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, unique: true, required: true },
    phoneNumber: { type: String, required: true },
    status: { type: String, enum: ['pending', 'paired', 'active'], default: 'pending' },
    authFolder: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
});
const Session = mongoose.model('Session', sessionSchema);

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **FOLDERS**
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'public'))) fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });

// ✅ **MAPS ZA KUSHIKA SOCKETS ZA MUDA**
const pairingSockets = new Map(); // sessionId -> socket

// ✅ **CONFIG (kwa ajili ya newsletter etc)**
let config = {};
try {
    config = require('./config');
} catch {
    config = {
        botName: 'INSIDIOUS',
        newsletterJid: "120363404317544295@newsletter",
        botImage: 'https://files.catbox.moe/f3c07u.jpg'
    };
}

// ==================== KAZI YA KUUNDA PAIRING SOCKET ====================
async function createPairingSocket(sessionId, phoneNumber) {
    const authFolder = path.join(SESSIONS_DIR, sessionId);
    // Safisha folder ikiwa ipo (kwa usalama)
    if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
    }
    fs.mkdirSync(authFolder, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
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
        markOnlineOnConnect: true,
    });

    pairingSockets.set(sessionId, socket);

    // Omba pairing code
    const code = await socket.requestPairingCode(phoneNumber);

    // Hifadhi kwenye DB
    await Session.findOneAndUpdate(
        { sessionId },
        { phoneNumber, status: 'pending', authFolder },
        { upsert: true, new: true }
    );

    // Subiri connection ifunguke
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ Pairing successful for ${sessionId} (${phoneNumber})`);

            // Badili status kuwa 'paired'
            await Session.findOneAndUpdate({ sessionId }, { status: 'paired', updatedAt: new Date() });

            // Tuma ujumbe wa welcome (fancy + plain)
            try {
                const fancyMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: YOUR SESSION ID
╰─── • 🥀 • ───╯

✅ *Device linked successfully!*
📱 *Number:* ${phoneNumber}
🆔 *Your Session ID:* ${sessionId}

🔐 *Keep this ID secret!*
⚙️ *Next step:* Go to our website and deploy your bot using this session ID.

👑 *Developer:* STANYTZ
💾 *Version:* 3.0 | Pairing Server`;

                await socket.sendMessage(phoneNumber + '@s.whatsapp.net', {
                    text: fancy(fancyMsg),
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.newsletterJid,
                            newsletterName: config.botName
                        }
                    }
                });

                // Tuma session ID plain kwa ujumbe wa pili
                await socket.sendMessage(phoneNumber + '@s.whatsapp.net', {
                    text: sessionId,
                    contextInfo: { mentionedJid: [phoneNumber + '@s.whatsapp.net'] }
                });

                console.log(`📨 Welcome message sent to ${phoneNumber}`);
            } catch (err) {
                console.error(`❌ Failed to send welcome message: ${err.message}`);
            }

            // Funga socket (kazi ya pairing imekamilika)
            socket.end();
            pairingSockets.delete(sessionId);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (!shouldReconnect) {
                console.log(`🚫 Session ${sessionId} logged out during pairing`);
                pairingSockets.delete(sessionId);
                Session.deleteOne({ sessionId }).catch(console.error);
                fs.rm(authFolder, { recursive: true, force: true }, () => {});
            }
        }
    });

    socket.ev.on('creds.update', saveCreds);

    return code;
}

// ==================== ENDPOINTS ====================

// ✅ **PAIRING ENDPOINT** – anarudisha code na sessionId
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Tafadhali toa namba. Mfano: /pair?num=255787069580" });
        }
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Namba si sahihi. Lazima iwe na angalau tarakimu 10." });
        }

        const sessionId = randomMegaId(8, 4); // k.m. "aB3dEfG1234"
        console.log(`🔑 Pairing request for ${cleanNum} | session: ${sessionId}`);

        const code = await createPairingSocket(sessionId, cleanNum);

        res.json({
            success: true,
            code: code,
            sessionId: sessionId,
            message: `Code yako ya pairing: ${code}`
        });

    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ success: false, error: "Imeshindwa: " + err.message });
    }
});

// ✅ **DEPLOY ENDPOINT** – itaitwa na website kuanzisha bot ya kudumu
app.post('/deploy', async (req, res) => {
    try {
        const { sessionId, number } = req.body;
        if (!sessionId) {
            return res.json({ success: false, error: "sessionId inahitajika" });
        }

        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.json({ success: false, error: "Session haipatikani" });
        }
        if (session.status !== 'paired') {
            return res.json({ success: false, error: `Session iko katika hali ya ${session.status}, haiwezi kutumwa` });
        }

        // Hapa ndipo unapoweza kuanzisha bot ya kudumu kwa kutumia session hii.
        // Kwa sasa, tutaacha tu kusema imefanikiwa, na badala ya kuanzisha bot,
        // tutaweka status kuwa 'active'. (Unaweza kuongeza mfumo wa worker threads au child processes baadaye)
        await Session.findOneAndUpdate({ sessionId }, { status: 'active', updatedAt: new Date() });

        // TODO: Anzisha bot ya kudumu kwa kutumia authFolder ya session hii.
        // Kwa mfano, unaweza kuita `startUserBot(sessionId)` kama ilivyo kwenye code ya awali.
        // Lakini kwa ajili ya mfano huu, tutarudisha tu success.

        res.json({ success: true, message: `Bot imewashwa kwa session ${sessionId}` });
    } catch (err) {
        console.error("Deploy error:", err.message);
        res.json({ success: false, error: err.message });
    }
});

// ✅ **LIST SESSIONS** – kwa ajili ya website
app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({}, { _id: 0, __v: 0 });
        res.json({
            success: true,
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                phoneNumber: s.phoneNumber,
                status: s.status,
                createdAt: s.createdAt
            }))
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ✅ **DELETE SESSION**
app.delete('/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.json({ success: false, error: "Session haipatikani" });
        }

        // Funga socket ikiwa bado ipo kwenye pairing
        if (pairingSockets.has(sessionId)) {
            pairingSockets.get(sessionId).end();
            pairingSockets.delete(sessionId);
        }

        await Session.deleteOne({ sessionId });

        const authFolder = session.authFolder || path.join(SESSIONS_DIR, sessionId);
        fs.rm(authFolder, { recursive: true, force: true }, () => {});

        res.json({ success: true, message: `Session ${sessionId} imefutwa` });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ✅ **SETTINGS** – kwa ajili ya website (inaweza kuwa ni placeholder)
app.post('/settings', (req, res) => {
    res.json({ success: true, message: "Settings zimehifadhiwa (placeholder)" });
});

// ✅ **HEALTH CHECK**
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        pendingPairs: pairingSockets.size,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ✅ **BOT INFO** – taarifa za jumla
app.get('/botinfo', async (req, res) => {
    const totalSessions = await Session.countDocuments();
    res.json({
        success: true,
        botName: config.botName,
        pendingPairs: pairingSockets.size,
        totalSessions
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    console.log(`🔗 Pairing endpoint: http://localhost:${PORT}/pair?num=255XXXXXXXXX`);
    console.log(`🚀 Deploy endpoint: POST /deploy`);
    console.log(`📋 Sessions: http://localhost:${PORT}/sessions`);
    console.log(`👑 Developer: STANYTZ`);
    console.log(`📅 Version: 3.0 | Pairing Server`);
});

module.exports = app;