const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

const handler = require('./handler');

// ✅ **MONGODB SCHEMA**
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    creds: { type: Object, required: true }, 
    status: { type: String, default: 'active' },
    addedAt: { type: Date, default: Date.now }
});
const Session = mongoose.model('UserSession', sessionSchema);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **SPEED OPTIMIZED GENERATORS**
function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

// ✅ **DB CONNECTION**
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority")
    .then(() => { console.log("✅ DB Connected"); loadActiveBots(); })
    .catch(err => console.log("❌ DB Error"));

// ✅ **PAIRING ENGINE (OPTIMIZED FOR SPEED)**
let pairingSocket = null;

async function startPairingEngine() {
    // 1. Force clear cache for instant startup
    if (fs.existsSync('./pairing_temp')) {
        fs.rmSync('./pairing_temp', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('pairing_temp');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"), // Better than Safari for fast handshake
        syncFullHistory: false, // ❌ ZIMA HISTORY SYNC (This is the fix!)
        shouldSyncHistoryMessage: () => false, // ❌ USIDOWNLOAD MESEJI
        connectTimeoutMs: 60000, 
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: false
    });

    pairingSocket = conn;

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            const userJid = conn.user.id.split(':')[0];
            const sessionId = randomMegaId();

            // Save to DB
            await Session.findOneAndUpdate(
                { phoneNumber: userJid },
                { sessionId, phoneNumber: userJid, creds: state.creds, status: 'active' },
                { upsert: true }
            );

            // Send messages quickly
            const msg = `✅ *Connected Successfully!*\n\n🆔 *SESSION ID:* \`${sessionId}\``;
            await conn.sendMessage(userJid + '@s.whatsapp.net', { text: msg });
            await conn.sendMessage(userJid + '@s.whatsapp.net', { text: sessionId });

            console.log(`✅ Session Created: ${sessionId}`);

            // Close connection immediately to free up resources
            setTimeout(async () => {
                await conn.logout();
                startPairingEngine(); 
            }, 3000);
        }

        if (connection === 'close') {
            const code = (lastDisconnect?.error)?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) startPairingEngine();
        }
    });

    conn.ev.on('creds.update', saveCreds);
}

// ✅ **BOT DEPLOYMENT (FOR LIVE BOTS)**
async function activateBot(sessionId, number) {
    try {
        const sessionData = await Session.findOne({ sessionId });
        if (!sessionData) return { success: false };

        const { version } = await fetchLatestBaileysVersion();
        const conn = makeWASocket({
            version,
            auth: { creds: sessionData.creds, keys: makeCacheableSignalKeyStore(sessionData.creds.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            syncFullHistory: false // Keep it light
        });

        conn.ev.on('messages.upsert', async (m) => {
            await handler(conn, m);
        });

        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

async function loadActiveBots() {
    const active = await Session.find({ status: 'active' });
    for (let sess of active) { activateBot(sess.sessionId, sess.phoneNumber); }
}

// ==================== ENDPOINTS ====================

app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.json({ success: false, error: "Number required" });
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        const code = await pairingSocket.requestPairingCode(cleanNum);
        res.json({ success: true, code });
    } catch (err) {
        res.json({ success: false, error: "Retry again" });
    }
});

app.post('/deploy', async (req, res) => {
    const { sessionId, number } = req.body;
    const result = await activateBot(sessionId, number);
    res.json(result);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start Engine
startPairingEngine();

app.listen(PORT, () => console.log(`🌐 FAST SERVER LIVE: ${PORT}`));