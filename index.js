const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER ====================
const handler = require('./handler');

// ✅ FANCY FUNCTION
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

// ==================== EXPRESS ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
if (!fs.existsSync(path.join(__dirname, 'public'))) fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// ==================== MONGODB ====================
console.log(fancy("🔗 Connecting to MongoDB..."));
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority", {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch(err => console.log(fancy("❌ MongoDB Connection FAILED: " + err.message)));

// ==================== GLOBAL VARIABLES ====================
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// Load config
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
        workMode: 'public',
        botImage: 'https://files.catbox.moe/f3c07u.jpg'
    };
}

// ==================== START BOT ====================
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
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("StanyTz"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true
        });

        globalConn = conn;
        botStartTime = Date.now();

        // ==================== CONNECTION UPDATE ====================
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                isConnected = true;

                // Bot info
                const botName = conn.user?.name || "INSIDIOUS";
                const botNumber = conn.user?.id?.split(':')[0] || "Unknown";
                const botId = handler.getBotId ? handler.getBotId() : "Unknown";
                const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;

                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                console.log(fancy(`🆔 Bot ID: ${botId}`));
                console.log(fancy(`👥 Paired Owners: ${pairedCount}`));

                // Initialize handler
                try {
                    if (handler && typeof handler.init === 'function') await handler.init(conn);
                    console.log(fancy("✅ Handler initialized"));
                } catch (e) {
                    console.error(fancy("❌ Handler init error:"), e.message);
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);

        // ==================== MESSAGE HANDLER ====================
        conn.ev.on('messages.upsert', async (m) => {
            try { if (handler && typeof handler === 'function') await handler(conn, m); }
            catch (error) { console.error("Message handler error:", error.message); }
        });

        conn.ev.on('group-participants.update', async (update) => {
            try { if (handler && handler.handleGroupUpdate) await handler.handleGroupUpdate(conn, update); }
            catch (error) { console.error("Group update error:", error.message); }
        });

        conn.ev.on('call', async (call) => {
            try { if (handler && handler.handleCall) await handler.handleCall(conn, call); }
            catch (error) { console.error("Call handler error:", error.message); }
        });

        console.log(fancy("🚀 Bot ready for pairing via web interface"));
    } catch (error) {
        console.error("Start error:", error.message);
    }
}

startBot();

// ==================== HTTP ENDPOINTS ====================
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        if (!globalConn) return res.json({ success: false, error: "Bot is initializing" });

        const cleanNum = num.replace(/[^0-9]/g, '');
        const code = handler?.generatePairCode ? await handler.generatePairCode(cleanNum) : Math.floor(10000000 + Math.random() * 90000000);

        res.json({ success: true, code, message: `8-digit pairing code: ${code}` });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ success: false, error: "Provide number! Example: /unpair?num=255123456789" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        const result = handler?.unpairNumber ? await handler.unpairNumber(cleanNum) : false;
        res.json({ success: result, message: result ? `Number ${cleanNum} unpaired` : `Failed to unpair ${cleanNum}` });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    const uptime = process.uptime();
    res.json({
        status: 'healthy',
        connected: isConnected,
        uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.get('/botinfo', (req, res) => {
    if (!globalConn || !globalConn.user) return res.json({ success: false, error: "Bot not connected" });
    res.json({
        success: true,
        botName: globalConn.user?.name || "INSIDIOUS",
        botNumber: globalConn.user?.id?.split(':')[0] || "Unknown",
        botJid: globalConn.user?.id || "Unknown",
        botSecret: handler.getBotId ? handler.getBotId() : "Unknown",
        pairedOwners: handler.getPairedNumbers ? handler.getPairedNumbers().length : 0,
        connected: isConnected,
        uptime: Date.now() - botStartTime
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
});

module.exports = app;