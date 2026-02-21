require('dotenv').config();
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
const { Session } = require('./database/models');
const handler = require('./handler');

const SESSION_ID = "insidious_main";

function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    const map = {
        a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',
        j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',
        s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',
        A:'ᴀ',B:'ʙ',C:'ᴄ',D:'ᴅ',E:'ᴇ',F:'ꜰ',G:'ɢ',H:'ʜ',I:'ɪ',
        J:'ᴊ',K:'ᴋ',L:'ʟ',M:'ᴍ',N:'ɴ',O:'ᴏ',P:'ᴘ',Q:'ǫ',R:'ʀ',
        S:'ꜱ',T:'ᴛ',U:'ᴜ',V:'ᴠ',W:'ᴡ',X:'x',Y:'ʏ',Z:'ᴢ'
    };
    return text.split('').map(c => map[c] || c).join('');
}

if (!process.env.MONGODB_URI) {
    console.log("❌ MONGODB_URI not set in .env");
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log(fancy("✅ MongoDB Connected")))
    .catch(err => {
        console.log(fancy("❌ MongoDB Connection Failed"));
        console.error(err.message);
        process.exit(1);
    });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

async function saveSession(creds, keys) {
    await Session.findOneAndUpdate(
        { sessionId: SESSION_ID },
        {
            $set: {
                creds,
                keys,
                lastActive: new Date(),
                isActive: true
            }
        },
        { upsert: true }
    );
}

async function loadSession() {
    return await Session.findOne({ sessionId: SESSION_ID });
}

async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS"));

        const sessionPath = path.join(__dirname, 'session');
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

        const storedSession = await loadSession();
        if (storedSession?.creds) {
            fs.writeFileSync(
                path.join(sessionPath, 'creds.json'),
                JSON.stringify(storedSession.creds, null, 2)
            );
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
            generateHighQualityLinkPreview: false,
            emitOwnEvents: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000
        });

        globalConn = conn;
        botStartTime = Date.now();

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS ONLINE"));
                isConnected = true;

                await saveSession(state.creds, state.keys);
                if (handler?.init) await handler.init(conn);
            }

            if (connection === 'close') {
                isConnected = false;
                const shouldReconnect =
                    lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                console.log(fancy("🔌 Connection closed"));

                if (shouldReconnect) {
                    console.log(fancy("🔄 Reconnecting in 5s..."));
                    setTimeout(startBot, 5000);
                } else {
                    console.log(fancy("❌ Logged out. Delete session & re-pair."));
                }
            }
        });

        conn.ev.on('creds.update', async () => {
            await saveCreds();
            await saveSession(state.creds, state.keys);
        });

        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler) await handler(conn, m);
            } catch (e) {
                console.error("Message error:", e.message);
            }
        });

    } catch (err) {
        console.error("Start error:", err.message);
    }
}

startBot();

/* ==================== API ENDPOINTS ==================== */

app.get('/pair', async (req, res) => {
    try {
        const num = req.query.num;
        if (!num) return res.json({ success: false, error: "Provide number" });

        const clean = num.replace(/[^0-9]/g, '');
        if (clean.length < 10)
            return res.json({ success: false, error: "Invalid number" });

        if (!globalConn)
            return res.json({ success: false, error: "Bot not ready" });

        if (!globalConn.authState?.creds?.registered)
            return res.json({ success: false, error: "Bot not ready for pairing" });

        const code = await globalConn.requestPairingCode(clean);
        res.json({ success: true, code });

    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: "healthy",
        connected: isConnected,
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1
    });
});

app.listen(PORT, () => {
    console.log(fancy(`🌐 Server running on http://localhost:${PORT}`));
    console.log(fancy("👑 Developer: STANYTZ"));
});

module.exports = app;