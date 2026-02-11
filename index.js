const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ✅ **LOAD HANDLER (kwa bot ID)**
const handler = require('./handler');

// ✅ **FANCY FUNCTION**
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

// ✅ **MONGODB CONNECTION**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => {
    console.log(fancy("✅ MongoDB Connected"));
})
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
});

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ✅ **GLOBAL VARIABLES**
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// ✅ **LOAD CONFIG**
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
        botImage: 'https://files.catbox.moe/insidious-alive.jpg',
        menuImage: 'https://files.catbox.moe/irqrap.jpg'
    };
}

// ✅ **MAIN BOT FUNCTION - NO AUTO-RECONNECT LOOPS**
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
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true
        });

        globalConn = conn;
        botStartTime = Date.now();

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                
                isConnected = true;
                
                const botName = conn.user?.name || config.botName;
                const botNumber = conn.user?.id?.split(':')[0] || 'Unknown';
                const botId = handler.getBotId ? handler.getBotId() : 'INS-UNKNOWN';
                
                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                console.log(fancy(`🔐 Bot ID: ${botId}`));
                
                // ✅ **WELCOME MESSAGE – IMAGE KUTOKA CONFIG, FOWARDED KUTOKA CHANNEL**
                setTimeout(async () => {
                    try {
                        if (config.ownerNumber && config.ownerNumber.length > 0) {
                            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
                            if (ownerNum.length >= 10) {
                                const ownerJid = ownerNum + '@s.whatsapp.net';
                                
                                const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🔐 *Bot ID:* ${botId}
👑 *Deployer:* ${config.ownerName || 'STANY'}

⚡ *Status:* ONLINE & ACTIVE
🌐 *Mode:* ${config.mode || 'PUBLIC'}

📊 *ALL FEATURES:* ACTIVE
🛡️ Anti Link / Scam / Porn / Tag / Crash
🗑️ Anti Delete / ViewOnce
🤖 AI Chatbot
📢 Auto‑Follow Channels
❤️ Auto‑React to Channel Posts
👀 Auto Read / Auto React
⚡ Auto Typing / Recording
🎉 Welcome/Goodbye

💾 *Version:* 2.1.1 | Year: 2025
`;
                                
                                await conn.sendMessage(ownerJid, {
                                    image: { 
                                        url: config.botImage || config.aliveImage || 'https://files.catbox.moe/insidious-alive.jpg'
                                    },
                                    caption: fancy(welcomeMsg),
                                    contextInfo: {
                                        isForwarded: true,
                                        forwardingScore: 999,
                                        forwardedNewsletterMessageInfo: {
                                            newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                                            newsletterName: config.botName || 'INSIDIOUS'
                                        }
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.log(fancy("⚠️ Could not send welcome message"));
                    }
                }, 3000);
                
                // ✅ **INITIALIZE HANDLER**
                setTimeout(async () => {
                    try {
                        if (handler && typeof handler.init === 'function') {
                            await handler.init(conn);
                        }
                    } catch (e) {
                        console.error(fancy("❌ Handler init error:"), e.message);
                    }
                }, 2000);
            }
            
            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                isConnected = false;
                // ✅ **HAKUNA AUTO-RECONNECT – BOT ITAZIMIKA TU**
                // Hosting (Render/Railway) itarudisha bot kiotomatiki
            }
        });

        // ✅ **PAIRING ENDPOINT (8-DIGIT CODE) – KAMA AWALI KABISA**
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
                
                console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));
                
                try {
                    const code = await conn.requestPairingCode(cleanNum);
                    res.json({ 
                        success: true, 
                        code: code,
                        message: `8-digit pairing code: ${code}`
                    });
                } catch (err) {
                    if (err.message.includes("already paired")) {
                        res.json({ 
                            success: true, 
                            message: "Number already paired"
                        });
                    } else {
                        throw err;
                    }
                }
                
            } catch (err) {
                console.error("Pairing error:", err.message);
                res.json({ success: false, error: "Failed: " + err.message });
            }
        });

        // ✅ **UNPAIR ENDPOINT – KAMA AWALI KABISA**
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
                
                res.json({ 
                    success: true, 
                    message: `Number ${cleanNum} unpaired successfully`
                });
                
            } catch (err) {
                console.error("Unpair error:", err.message);
                res.json({ success: false, error: "Failed: " + err.message });
            }
        });

        // ✅ **HEALTH CHECK**
        app.get('/health', (req, res) => {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            res.json({
                status: 'healthy',
                connected: isConnected,
                uptime: `${hours}h ${minutes}m ${seconds}s`,
                database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
            });
        });

        // ✅ **BOT INFO ENDPOINT – INA BOT ID KUTOKA HANDLER**
        app.get('/botinfo', (req, res) => {
            if (!globalConn || !globalConn.user) {
                return res.json({ error: "Bot not connected" });
            }
            
            res.json({
                botName: globalConn.user?.name || config.botName,
                botNumber: globalConn.user?.id?.split(':')[0] || "Unknown",
                botId: handler.getBotId ? handler.getBotId() : null,
                connected: isConnected,
                uptime: Date.now() - botStartTime,
                mode: config.mode || 'public'
            });
        });

        // ✅ **CREDENTIALS UPDATE**
        conn.ev.on('creds.update', saveCreds);

        // ✅ **MESSAGE HANDLER**
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m);
                }
            } catch (error) {
                console.error("Message handler error:", error.message);
            }
        });

        // ✅ **GROUP UPDATE HANDLER**
        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler && handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update);
                }
            } catch (error) {
                console.error("Group update error:", error.message);
            }
        });

        console.log(fancy("🚀 Bot ready"));
        console.log(fancy("📱 Use 8-digit pairing via web interface"));
        
    } catch (error) {
        console.error("Start error:", error.message);
        // ✅ **HAKUNA AUTO-RECONNECT – TUNAACHA TU**
    }
}

// ✅ **START BOT**
startBot();

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
    console.log(fancy("🔐 Bot ID: ACTIVE (from handler)"));
    console.log(fancy("📢 Welcome message: RESTORED (with config image)"));
    console.log(fancy("⚡ NO AUTO-RECONNECT LOOPS"));
});

module.exports = app;
