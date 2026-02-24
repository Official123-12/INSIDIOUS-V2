const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

const handler = require('./handler');

// ✅ **DATABASE MODEL (Kuhifadhi Sessions)**
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    creds: { type: Object, required: true }, // Hapa tunahifadhi siri za WhatsApp
    status: { type: String, default: 'active' },
    date: { type: Date, default: Date.now }
});
const Session = mongoose.model('UserSession', sessionSchema);

function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const fancyMap = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
        let result = '';
        for (let i = 0; i < text.length; i++) { result += fancyMap[text[i].toLowerCase()] || text[i]; }
        return result;
    } catch (e) { return text; }
}

function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **MONGODB CONNECTION**
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority")
.then(() => { console.log(fancy("✅ Connected to MongoDB")); loadActiveBots(); })
.catch((err) => console.log("❌ DB Error: " + err.message));

let globalConn = null;
let isConnected = false;

// ✅ **PAIRING ENGINE**
async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState('pairing_temp');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari")
    });

    globalConn = conn;

    conn.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            const userJid = conn.user.id.split(':')[0];
            const sessionId = randomMegaId();

            // ✅ 1. HIFADHI KWENYE DATABASE
            await Session.create({
                sessionId: sessionId,
                phoneNumber: userJid,
                creds: state.creds // Tunatunza state yote ya auth
            });

            // ✅ 2. TUMA SESSION ID KWA USER
            const msg = `🆔 *SESSION ID:* \`${sessionId}\`\n\nCopy kodi hii na u-deploy kwenye website yako ili bot iwe active!`;
            await conn.sendMessage(userJid + '@s.whatsapp.net', { text: msg });
            await conn.sendMessage(userJid + '@s.whatsapp.net', { text: sessionId });

            console.log(fancy(`✅ Session Saved: ${sessionId}`));
            
            // ✅ 3. LOGOUT (Ili pairing ibaki safi)
            setTimeout(async () => {
                await conn.logout();
                if (fs.existsSync('./pairing_temp')) fs.rmSync('./pairing_temp', { recursive: true, force: true });
            }, 5000);
        }
    });

    conn.ev.on('creds.update', saveCreds);
}

// ✅ **FUNCTION YA KU-ACTIVATE BOT (Deployment)**
async function activateBot(sessionId, number) {
    try {
        const sessionData = await Session.findOne({ sessionId });
        if (!sessionData) return { success: false, error: "Session not found" };

        // Hapa sasa ndipo bot inakuwa live (Inaita handler yako)
        // Kwenye mfumo huu, tunarun instance mpya ya Baileys kwa kila session iliyopo active
        const { version } = await fetchLatestBaileysVersion();
        const conn = makeWASocket({
            version,
            auth: { creds: sessionData.creds, keys: makeCacheableSignalKeyStore(sessionData.creds.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Chrome")
        });

        conn.ev.on('messages.upsert', async (m) => {
            await handler(conn, m); // Handler yako inaanza kazi hapa
        });

        console.log(fancy(`🚀 Bot Active for: ${number}`));
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ✅ **KURESTART BOT ZOTE ZILIZOPO KWENYE DB (Run on start)**
async function loadActiveBots() {
    const activeSessions = await Session.find({ status: 'active' });
    for (let sess of activeSessions) {
        await activateBot(sess.sessionId, sess.phoneNumber);
    }
}

// ==================== API ENDPOINTS FOR WEBSITE ====================

// 1. Endpoint ya Pairing
app.get('/pair', async (req, res) => {
    if (!req.query.num) return res.json({ success: false, error: "Namba inahitajika" });
    const code = await globalConn.requestPairingCode(req.query.num.replace(/[^0-9]/g, ''));
    res.json({ success: true, code });
});

// 2. Endpoint ya Deployment (Inaitwa na website yako)
app.post('/deploy', async (req, res) => {
    const { sessionId, number } = req.body;
    const result = await activateBot(sessionId, number);
    res.json(result);
});

// 3. Kupata list ya sessions (Kwa ajili ya website)
app.get('/sessions', async (req, res) => {
    const data = await Session.find({}, { creds: 0 }); // Usitume creds kwa browser!
    res.json({ success: true, sessions: data });
});

// 4. Kufuta session
app.delete('/sessions/:id', async (req, res) => {
    await Session.deleteOne({ sessionId: req.params.id });
    res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

startPairing();
app.listen(PORT, () => console.log(`🌐 Station Live on Port ${PORT}`));

module.exports = app;