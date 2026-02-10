const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ✅ **FANCY FUNCTION - WORKING**
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    
    try {
        const fancyMap = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ',
            0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉'
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

// ✅ **MONGODB CONNECTION - MUST (NO FALLBACK)**
console.log(fancy("🔗 Connecting to MongoDB..."));

// Hapa tumia connection string yako ya MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

// Connect to MongoDB - MUST (hapana memory mode)
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    w: 'majority'
})
.then(() => {
    console.log(fancy("✅ MongoDB Connected Successfully"));
    console.log(fancy("📊 Database: insidious"));
    console.log(fancy("⚡ Connection: Stable"));
})
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("🚨 Bot cannot start without database"));
    console.log(fancy("🔧 Please check your MongoDB connection"));
    console.log(fancy("💡 Error: " + err.message));
    process.exit(1); // Stop bot kama database haifanyi kazi
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

// ✅ **BOT STATUS**
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();
let totalMessages = 0;

// ✅ **LOAD CONFIG**
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded successfully"));
} catch (error) {
    console.log(fancy("❌ Config file not found or has errors"));
    console.log(fancy("📁 Creating default config..."));
    
    // Create default config
    const defaultConfig = `module.exports = {
    ownerNumber: ["2557xxxxxxx"], // Weka nambari yako hapa
    botName: "INSIDIOUS",
    prefix: ".",
    developerName: "STANYTZ"
};`;
    
    fs.writeFileSync('./config.js', defaultConfig);
    config = require('./config');
}

// ✅ **MAIN BOT FUNCTION**
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS: THE LAST KEY..."));
        
        // ✅ **AUTHENTICATION**
        const { state, saveCreds } = await useMultiFileAuthState('insidious_session');
        const { version } = await fetchLatestBaileysVersion();

        // ✅ **CREATE CONNECTION**
        const conn = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            logger: pino({ level: "fatal" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true
        });

        globalConn = conn;
        botStartTime = Date.now();

        // ✅ **CONNECTION EVENT HANDLER**
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                
                isConnected = true;
                
                // Get bot info
                let botName = conn.user?.name || "INSIDIOUS";
                let botNumber = "Unknown";
                
                if (conn.user?.id) {
                    botNumber = conn.user.id.split(':')[0] || "Unknown";
                }
                
                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                
                // ✅ **SEND CONNECTION MESSAGE TO OWNER**
                setTimeout(async () => {
                    try {
                        if (config.ownerNumber && config.ownerNumber.length > 0) {
                            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
                            if (ownerNum.length >= 10) {
                                const ownerJid = ownerNum + '@s.whatsapp.net';
                                
                                const connectionMsg = `
╭─── • 🥀 • ───╮
INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
👤 User: ${conn.user?.name || "Insidious"}
🆔 ID: ${conn.user?.id?.split(':')[0] || "Unknown"}
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🕐 *Time:* ${new Date().toLocaleTimeString()}
📅 *Date:* ${new Date().toLocaleDateString()}
⚡ *Status:* ONLINE & ACTIVE

📊 *SYSTEM STATUS:*
🛡️ All Anti Features: ✅ ACTIVE
🤖 AI Chatbot: ✅ AUTO MODE
👁️ Anti View Once: ✅ ACTIVE
🗑️ Anti Delete: ✅ ACTIVE
📼 Auto Recording: ✅ ACTIVE
⌨️ Auto Typing: ✅ ACTIVE
👀 Auto Read: ✅ ACTIVE
❤️ Auto React: ✅ ACTIVE
🎉 Welcome/Goodbye: ✅ ACTIVE
📞 Anti Call: ✅ ACTIVE
🚫 Anti Spam: ✅ ACTIVE
🐛 Anti Bug: ✅ ACTIVE

📈 *30+ Features Active*
🎯 All systems operational... 🚀

👑 *Developer:* STANYTZ
💾 *Version:* 2.1.1 | Year: 2025
🙏 *Special Thanks:* REDTECH`;
                                
                                await conn.sendMessage(ownerJid, { text: connectionMsg });
                            }
                        }
                    } catch (e) {
                        // Silent error
                    }
                }, 3000);
                
                // ✅ **INITIALIZE HANDLER**
                setTimeout(async () => {
                    try {
                        const handler = require('./handler');
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
                
                // ✅ **SILENT RECONNECT - NO MESSAGES**
                // Tuendelee tu, render atareconnect
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    // Silent reconnect after 5 seconds
                    setTimeout(() => {
                        startBot();
                    }, 5000);
                }
            }
        });

        // ✅ **PAIRING ENDPOINT - 8-DIGIT CODE**
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

        // ✅ **HEALTH CHECK ENDPOINT**
        app.get('/health', (req, res) => {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            res.json({
                status: 'healthy',
                connected: isConnected,
                botName: config.botName || "INSIDIOUS",
                uptime: `${hours}h ${minutes}m ${seconds}s`,
                totalMessages: totalMessages,
                database: 'connected',
                timestamp: new Date().toISOString()
            });
        });

        // ✅ **BOT INFO ENDPOINT**
        app.get('/info', (req, res) => {
            res.json({
                bot: {
                    name: config.botName || "INSIDIOUS",
                    version: "2.1.1",
                    year: 2025,
                    developer: config.developerName || "STANYTZ"
                },
                connection: {
                    status: isConnected ? "ONLINE" : "OFFLINE",
                    uptime: Math.floor((Date.now() - botStartTime) / 1000) + "s"
                },
                database: {
                    status: "CONNECTED",
                    type: "MongoDB"
                },
                features: {
                    antiFeatures: 12,
                    autoFeatures: 8,
                    totalFeatures: 30
                }
            });
        });

        // ✅ **CREDENTIALS UPDATE**
        conn.ev.on('creds.update', saveCreds);

        // ✅ **MESSAGE HANDLER**
        conn.ev.on('messages.upsert', async (m) => {
            totalMessages++;
            try {
                const handler = require('./handler');
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
                const handler = require('./handler');
                if (handler && handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update);
                }
            } catch (error) {
                console.error("Group update error:", error.message);
            }
        });

        console.log(fancy("==========================================="));
        console.log(fancy("🚀 INSIDIOUS: THE LAST KEY IS READY"));
        console.log(fancy("==========================================="));
        
    } catch (error) {
        console.error(fancy("❌ Bot start error:"), error.message);
        
        // Silent restart after 10 seconds
        setTimeout(() => {
            startBot();
        }, 10000);
    }
}

// ✅ **START BOT**
startBot();

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy("==========================================="));
    console.log(fancy("🌐 WEB INTERFACE IS READY"));
    console.log(fancy("==========================================="));
    console.log(fancy(`📊 Dashboard: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`❤️ Health Check: http://localhost:${PORT}/health`));
    console.log(fancy(`📈 Bot Info: http://localhost:${PORT}/info`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
    console.log(fancy("==========================================="));
});

// ✅ **EXPORT FOR RENDER/PM2**
module.exports = app;
