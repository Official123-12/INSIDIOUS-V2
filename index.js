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

// ==================== HANDLER ====================
const handler = require('./handler');

// ==================== FANCY FUNCTION ====================
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const fancyMap = {
            a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',
            j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',
            s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',
            A:'ᴀ',B:'ʙ',C:'ᴄ',D:'ᴅ',E:'ᴇ',F:'ꜰ',G:'ɢ',H:'ʜ',I:'ɪ',
            J:'ᴊ',K:'ᴋ',L:'ʟ',M:'ᴍ',N:'ɴ',O:'ᴏ',P:'ᴘ',Q:'ǫ',R:'ʀ',
            S:'ꜱ',T:'ᴛ',U:'ᴜ',V:'ᴠ',W:'ᴡ',X:'x',Y:'ʏ',Z:'ᴢ'
        };
        return text.split('').map(c => fancyMap[c] || c).join('');
    } catch {
        return text;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MONGODB ====================
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch(err => console.log(fancy("❌ MongoDB Error: " + err.message)));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ==================== GLOBALS ====================
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// ==================== CONFIG ====================
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch {
    config = {
        prefix: '.',
        ownerNumber: ['255000000000'],
        botName: 'INSIDIOUS',
        botImage: 'https://files.catbox.moe/f3c07u.jpg'
    };
}

// ==================== MAIN BOT ====================
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS..."));

        // ✅ Session Folder Safety
        const sessionPath = path.join(__dirname, 'insidious_session');
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
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
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true
        });

        globalConn = conn;
        botStartTime = Date.now();

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(fancy("✅ Bot Connected Successfully"));
                isConnected = true;

                if (handler?.init) {
                    await handler.init(conn);
                }
            }

            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                isConnected = false;

                const statusCode = lastDisconnect?.error?.output?.statusCode;

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(fancy("🚫 Logged out. Scan QR again."));
                } else {
                    console.log(fancy("🔄 Reconnecting in 5 seconds..."));
                    setTimeout(() => {
                        try { globalConn?.end(); } catch {}
                        startBot();
                    }, 5000);
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (typeof handler === 'function') {
                    await handler(conn, m);
                }
            } catch (e) {
                console.log("Message error:", e.message);
            }
        });

        console.log(fancy("🚀 Bot ready for pairing"));

    } catch (err) {
        console.log("Start error:", err.message);
        setTimeout(startBot, 10000);
    }
}

startBot();

// ==================== PAIR ENDPOINT ====================
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ success:false, error:"Provide number" });

        const cleanNum = num.replace(/[^0-9]/g, '');

        if (!globalConn || !isConnected) {
            return res.json({ success:false, error:"Bot not fully connected" });
        }

        const code = await Promise.race([
            globalConn.requestPairingCode(cleanNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000))
        ]);

        res.json({ success:true, code });

    } catch (err) {
        res.json({ success:false, error:err.message });
    }
});

// ==================== HEALTH ====================
app.get('/health', (req, res) => {
    res.json({
        connected: isConnected,
        database: mongoose.connection.readyState === 1
    });
});

// ==================== SERVER ====================
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pair: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
});