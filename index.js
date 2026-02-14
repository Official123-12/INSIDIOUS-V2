const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs').promises;
const crypto = require('crypto');

// ✅ **FANCY FUNCTION (USIGUSE)**
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

// ✅ **MONGODB**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch(err => console.log(fancy("❌ MongoDB Connection FAILED")));

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **GLOBAL VARS**
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// ✅ **LOAD CONFIG**
let config = {};
try { config = require('./config'); } catch {
    config = { prefix: '.', ownerNumber: ['255000000000'], botName: 'INSIDIOUS', workMode: 'public' };
}

// ✅ **LOAD HANDLER**
let handler = null;
try { handler = require('./handler'); } catch (e) {}

// ==================== MAIN BOT – INFINITE STAY-ALIVE ====================
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS..."));
        const { state, saveCreds } = await useMultiFileAuthState('insidious_session');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false, // 🚀 FIX: Zima history kwa ajili ya link ya haraka
            shouldSyncHistoryMessage: () => false, // 🚀 FIX: Kataa history kabisa
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: true,
            maxRetryCount: Infinity,
            retryRequestDelayMs: 1000
        });

        globalConn = conn;
        botStartTime = Date.now();

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(fancy("✅ Bot online and secure"));
                isConnected = true;
                if (handler && handler.init) await handler.init(conn).catch(() => {});
            }
            if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log(fancy("⚠️ Reconnecting..."));
                    setTimeout(startBot, 5000);
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', async (m) => {
            try { if (handler) await handler(conn, m); } catch (e) {}
        });

    } catch (error) {
        setTimeout(startBot, 10000);
    }
}
startBot();

// ==================== ROBUST PAIRING – MULTI‑USER SUPPORT ====================
async function requestPairingCode(number) {
    const sessionId = crypto.randomBytes(8).toString('hex');
    const sessionDir = path.join(__dirname, `temp_pair_${sessionId}`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const tempConn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false // 🚀 FIX: Lazima iwe false hapa pia
        });

        tempConn.ev.on('creds.update', saveCreds);

        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                tempConn.end();
                reject(new Error(`⏰ Pairing timeout`));
            }, 60000);

            // Wait for socket stability
            await new Promise(r => setTimeout(r, 4000));
            
            if (!tempConn.authState.creds.registered) {
                try {
                    const code = await tempConn.requestPairingCode(number);
                    clearTimeout(timeout);
                    // Cleanup session after return
                    setTimeout(async () => {
                        tempConn.end();
                        await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
                    }, 10000);
                    resolve(code);
                } catch (err) {
                    reject(err);
                }
            }
        });
    } catch (err) {
        throw err;
    }
}

// ==================== PAIRING ENDPOINT ====================
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ error: "Provide number!" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));
        const code = await requestPairingCode(cleanNum);

        res.json({
            success: true,
            code: code,
            formattedCode: code.match(/.{1,4}/g)?.join('-') || code
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'alive', connected: isConnected, uptime: process.uptime() });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(fancy(`🌐 server live on port ${PORT}`));
});

module.exports = app;