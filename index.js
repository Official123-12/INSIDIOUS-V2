const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs-extra');

// -------------------- FANCY FUNCTION --------------------
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    const fancyMap = {
        a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
        j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
        s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
        A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
        J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
        S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
    };
    return text.split('').map(c => fancyMap[c] || c).join('');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MONGODB – INAVUMILIA KUSHINDWA
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority'
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
});

// ✅ MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
fs.ensureDirSync(path.join(__dirname, 'public'));

// ✅ WEB ROUTES – ORIGINAL TU (HAKUNA PAIRING, HAKUNA UNPAIR, HAKUNA PAIRED)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// ✅ GLOBAL VARS
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// ✅ LOAD CONFIG
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("❌ Config file error, using defaults"));
    config = {
        prefix: '.',
        ownerNumber: ['255000000000'],
        ownerName: 'STANY',
        botName: 'INSIDIOUS',
        workMode: 'public',
        newsletterJid: '120363404317544295@newsletter',
        aliveImage: 'https://files.catbox.moe/insidious-alive.jpg',
        menuImage: 'https://files.catbox.moe/irqrap.jpg'
    };
}

// ✅ LOAD HANDLER
const handler = require('./handler');

// ✅ BOT START – NO QR WARNINGS, NO AUTO-RECONNECT LOOPS
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS..."));
        const { state, saveCreds } = await useMultiFileAuthState('insidious_session');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            logger: pino({ level: "silent" }), // NO QR WARNINGS
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true
            // NO printQRInTerminal
        });

        globalConn = conn;
        botStartTime = Date.now();

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                isConnected = true;
                console.log(fancy(`🤖 Name: ${conn.user?.name || config.botName}`));
                console.log(fancy(`📞 Number: ${conn.user?.id?.split(':')[0] || 'Unknown'}`));
                
                // ✅ INIT HANDLER – AUTO-FOLLOW, WELCOME, PAIRING, SETTINGS
                try {
                    if (handler && typeof handler.init === 'function') {
                        await handler.init(conn);
                    }
                } catch (e) {
                    console.error(fancy("❌ Handler init error:"), e.message);
                }
            }
            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                isConnected = false;
                // HAKUNA AUTO-RECONNECT – host ina-restart
            }
        });

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') await handler(conn, m);
            } catch (error) {
                console.error("Message handler error:", error.message);
            }
        });
        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler && handler.handleGroupUpdate) await handler.handleGroupUpdate(conn, update);
            } catch (error) {
                console.error("Group update error:", error.message);
            }
        });

        console.log(fancy("🚀 Bot ready – WhatsApp commands only"));
    } catch (error) {
        console.error("Start error:", error.message);
    }
}
startBot();

// ==================== WEB ENDPOINTS – ORIGINAL TU ====================

// ✅ HEALTH CHECK
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    res.json({
        status: 'healthy',
        connected: isConnected,
        uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ✅ BOT INFO
app.get('/botinfo', (req, res) => {
    if (!globalConn?.user) return res.json({ error: "Bot not connected" });
    res.json({
        botName: globalConn.user?.name || config.botName,
        botNumber: globalConn.user?.id?.split(':')[0] || 'Unknown',
        botId: handler.getBotId ? handler.getBotId() : null,
        connected: isConnected,
        uptime: Date.now() - botStartTime,
        mode: config.mode || 'public'
    });
});

// ✅ KEEP-ALIVE (FOR RENDER/RAILWAY)
app.get('/keep-alive', (req, res) => {
    res.json({ 
        status: 'alive', 
        timestamp: new Date().toISOString(), 
        bot: config.botName || 'INSIDIOUS',
        connected: isConnected
    });
});

// ✅ START SERVER
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo`));
    console.log(fancy(`💓 Keep-alive: http://localhost:${PORT}/keep-alive`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    console.log(fancy("✅ ALL FEATURES: COMPLETE"));
    console.log(fancy("🔐 Pairing: WHATSAPP COMMANDS ONLY"));
    console.log(fancy("⚡ NO AUTO-RECONNECT LOOPS"));
    console.log(fancy("🍃 MongoDB: CONFIGURED"));
});

module.exports = app;
