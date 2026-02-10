const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const { fancy } = require("./lib/font");
const path = require("path");
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE CONNECTION
console.log(fancy("🔗 Connecting to database..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log(fancy("✅ Database Connected"));
})
.catch((err) => {
    console.log(fancy("⚠️ Running without database..."));
});

// MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SIMPLE ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API ENDPOINTS
app.get('/api/stats', async (req, res) => {
    try {
        const { User, Group, Settings } = require('./database/models');
        const users = await User.countDocuments();
        const groups = await Group.countDocuments();
        const settings = await Settings.findOne();
        
        res.json({
            users,
            groups,
            settings: settings || {},
            uptime: process.uptime(),
            version: "2.1.1",
            botName: "INSIDIOUS: THE LAST KEY"
        });
    } catch (error) {
        res.json({ error: "Database not available", stats: { users: 0, groups: 0 } });
    }
});

let globalConn = null;
let isConnected = false;
let reconnectCount = 0;
const MAX_RECONNECT = 15;

async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('insidious_session');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            printQRInTerminal: false
        });

        globalConn = conn;

        // CONNECTION HANDLER
        conn.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS V2.1.1 ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                isConnected = true;
                reconnectCount = 0;
                
                // SAVE SESSION TO DATABASE
                try {
                    const { User } = require('./database/models');
                    const botUser = await User.findOne({ jid: conn.user.id });
                    if (!botUser) {
                        await new User({
                            jid: conn.user.id,
                            name: conn.user.name,
                            deviceId: conn.user.id.split(':')[0],
                            isActive: true,
                            linkedAt: new Date()
                        }).save();
                    }
                } catch (e) {}
                
                // CONNECTION MESSAGE TO OWNER
                try {
                    const config = require('./config');
                    const connectionMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
👤 User: ${conn.user?.name || "Insidious"}
🆔 ID: ${conn.user?.id?.split(':')[0] || "Unknown"}
🕐 Time: ${new Date().toLocaleTimeString()}
📱 Device: WhatsApp Web

⚙️ *Features Active:*
🛡️ Anti Link: ✅
🚫 Anti Porn: ✅
⚠️ Anti Scam: ✅
📷 Anti Media: ✅
#️⃣ Anti Tag: ✅
👁️ Anti View Once: ✅
🗑️ Anti Delete: ✅
💤 Sleeping Mode: ✅
🎉 Welcome/Goodbye: ✅
🤖 AI Chatbot: ✅
👀 Auto Read: ✅
❤️ Auto React: ✅
📼 Auto Recording: ✅
📞 Anti Call: ✅

${fancy("Ready with all security features... 🔐")}`;
                    
                    // Send to bot owner
                    if (config.ownerNumber && config.ownerNumber.length > 0) {
                        const ownerJid = config.ownerNumber[0] + '@s.whatsapp.net';
                        await conn.sendMessage(ownerJid, { text: connectionMsg });
                    }
                    
                } catch (e) {
                    console.log("Connection message error:", e.message);
                }
                
                // INITIALIZE HANDLER
                try {
                    const handler = require('./handler');
                    if (handler.init) {
                        await handler.init(conn);
                    }
                } catch (e) {
                    console.error("Handler init error:", e.message);
                }
            }
            
            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                isConnected = false;
                const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect && reconnectCount < MAX_RECONNECT) {
                    reconnectCount++;
                    const delayTime = Math.min(2000 * reconnectCount, 20000);
                    console.log(fancy(`🔄 Reconnecting in ${delayTime/1000}s... (Attempt ${reconnectCount}/${MAX_RECONNECT})`));
                    setTimeout(start, delayTime);
                } else if (reconnectCount >= MAX_RECONNECT) {
                    console.log(fancy("❌ Max reconnection attempts reached"));
                }
            }
        });

        // PAIRING ENDPOINT - 8-DIGIT CODE ONLY
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
                        message: `8-digit pairing code: ${code}`,
                        instructions: "Open WhatsApp → Settings → Linked Devices → Link a Device → Enter 8-digit Code",
                        validFor: "Code valid for 20 seconds",
                        note: "Multiple devices can use the same number"
                    });
                    
                } catch (err) {
                    if (err.message.includes("already paired") || err.message.includes("duplicate")) {
                        res.json({ 
                            success: true, 
                            message: "Number already paired with bot",
                            note: "You can use the bot on multiple devices"
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

        // HEALTH CHECK
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                connected: isConnected,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });

        // BOT STATUS
        app.get('/status', (req, res) => {
            res.json({
                connected: isConnected,
                owner: conn.user?.id?.split(':')[0] || 'Not connected',
                name: conn.user?.name || 'INSIDIOUS',
                uptime: process.uptime(),
                version: "2.1.1",
                developer: "STANYTZ",
                year: "2025",
                updated: "2026"
            });
        });

        // CREDENTIALS UPDATE
        conn.ev.on('creds.update', saveCreds);

        // MESSAGE HANDLER
        conn.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message) return;

            try {
                require('./handler')(conn, m);
            } catch (e) {
                console.error("Handler error:", e.message);
            }
        });

        // GROUP UPDATES
        conn.ev.on('group-participants.update', async (update) => {
            try {
                const handler = require('./handler');
                if (handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update);
                }
            } catch (e) {
                console.error("Group update error:", e.message);
            }
        });

        console.log(fancy("🚀 INSIDIOUS ready for 8-digit pairing"));
        
    } catch (error) {
        console.error("Start error:", error.message);
        if (reconnectCount < MAX_RECONNECT) {
            reconnectCount++;
            const delayTime = Math.min(3000 * reconnectCount, 25000);
            console.log(fancy(`🔄 Restarting in ${delayTime/1000}s...`));
            setTimeout(start, delayTime);
        }
    }
}

// START BOT
start();

// START SERVER
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy(`📊 Status: http://localhost:${PORT}/status`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Year: 2025 | Updated: 2026"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
});

// KEEP ALIVE FOR RENDER/RAILWAY
const keepAlive = () => {
    const http = require('http');
    setInterval(() => {
        http.get(`http://localhost:${PORT}/health`, (res) => {
            if (res.statusCode === 200) {
                console.log(fancy(`❤️ Keep-alive ping successful at ${new Date().toLocaleTimeString()}`));
            }
        }).on('error', (err) => {
            console.log(fancy(`⚠️ Keep-alive failed: ${err.message}`));
        });
    }, 240000); // Every 4 minutes
};

keepAlive();

// AUTO RECONNECT
setInterval(() => {
    if (!isConnected && reconnectCount < MAX_RECONNECT) {
        console.log(fancy("🔌 Connection lost, attempting auto-reconnect..."));
        start();
    }
}, 30000); // Check every 30 seconds

module.exports = app;
