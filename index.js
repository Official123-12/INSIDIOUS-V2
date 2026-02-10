const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");
const config = require("./config");
const { fancy } = require("./lib/font");
const path = require("path");
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE CONNECTION - FIXED DEPRECATED WARNINGS
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
        const { User, Group, ChannelSubscriber, Settings } = require('./database/models');
        const users = await User.countDocuments();
        const groups = await Group.countDocuments();
        const subscribers = await ChannelSubscriber.countDocuments();
        const settings = await Settings.findOne();
        
        res.json({
            users,
            groups,
            subscribers,
            settings: settings || {},
            uptime: process.uptime(),
            version: config.version || "2.1.1",
            botName: config.botName || "Insidious"
        });
    } catch (error) {
        res.json({ error: "Database not available", stats: { users: 0, groups: 0, subscribers: 0 } });
    }
});

app.get('/api/features', async (req, res) => {
    try {
        const { Settings } = require('./database/models');
        const settings = await Settings.findOne() || {};
        res.json({
            features: {
                antilink: settings.antilink || config.antilink || true,
                antiporn: settings.antiporn || config.antiporn || true,
                antiscam: settings.antiscam || config.antiscam || true,
                antimedia: settings.antimedia || config.antimedia || false,
                antitag: settings.antitag || config.antitag || true,
                antiviewonce: settings.antiviewonce || config.antiviewonce || true,
                antidelete: settings.antidelete || config.antidelete || true,
                sleepingMode: settings.sleepingMode || config.sleepingMode || false,
                welcomeGoodbye: settings.welcomeGoodbye || config.welcomeGoodbye || true,
                activeMembers: settings.activeMembers || config.activeMembers || false,
                autoblockCountry: settings.autoblockCountry || config.autoblockCountry || false,
                chatbot: settings.chatbot || config.chatbot || true,
                autoStatus: settings.autoStatus || config.autoStatus || true,
                autoRead: settings.autoRead || config.autoRead || true,
                autoReact: settings.autoReact || config.autoReact || true,
                autoSave: settings.autoSave || config.autoSave || false,
                autoBio: settings.autoBio || config.autoBio || true,
                anticall: settings.anticall || config.anticall || true,
                downloadStatus: settings.downloadStatus || config.downloadStatus || false,
                antispam: settings.antispam || config.antispam || true,
                antibug: settings.antibug || config.antibug || true,
                autoStatusReply: settings.autoStatusReply || config.autoStatusReply || true,
                autoRecording: settings.autoRecording || config.autoRecording || true
            }
        });
    } catch (error) {
        res.json({ error: "Settings not available", features: {} });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { feature, value } = req.body;
        const { Settings } = require('./database/models');
        
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        if (settings[feature] !== undefined) {
            settings[feature] = value;
            await settings.save();
            res.json({ success: true, message: `${feature} updated to ${value}` });
        } else {
            res.json({ success: false, message: `Feature ${feature} not found` });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

let globalConn = null;
let isConnected = false;
let reconnectCount = 0;
const MAX_RECONNECT = 10;

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
            syncFullHistory: false
        });

        globalConn = conn;

        // CONNECTION HANDLER
        conn.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
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
                            linkedAt: new Date(),
                            isFollowingChannel: true
                        }).save();
                    }
                } catch (e) {}
                
                // SIMPLE CONNECTION MESSAGE TO OWNER
                try {
                    const uniqueEmoji = ["👑", "🌟", "✨", "⚡", "🔥", "💫"];
                    const randomEmoji = uniqueEmoji[Math.floor(Math.random() * uniqueEmoji.length)];
                    
                    const connectionMsg = `
╭─── • 🥀 • ───╮
   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
${randomEmoji} Session: Active
👤 User: ${conn.user?.name || "Insidious"}
🆔 ID: ${conn.user?.id?.split(':')[0] || "Unknown"}
🕐 Time: ${new Date().toLocaleTimeString()}

⚙️ *Features Ready:*
🤖 AI Chatbot: ✅
👁️ Anti-Viewonce: ✅
🗑️ Anti-Delete: ✅
📱 Auto Recording: ✅
💕 Human Emotions: ✅
🛡️ All Anti Features: ✅

${fancy("Ready with love & feelings... ❤️")}`;
                    
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
                
                // AUTO FOLLOW CHANNEL FOR ALL SESSIONS
                try {
                    const { ChannelSubscriber } = require('./database/models');
                    const existing = await ChannelSubscriber.findOne({ jid: conn.user.id });
                    if (!existing) {
                        await new ChannelSubscriber({
                            jid: conn.user.id,
                            name: conn.user.name,
                            subscribedAt: new Date(),
                            isActive: true
                        }).save();
                        console.log(fancy("✅ Auto-followed channel for session"));
                    }
                } catch (e) {}
            }
            
            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                isConnected = false;
                const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect && reconnectCount < MAX_RECONNECT) {
                    reconnectCount++;
                    const delayTime = Math.min(3000 * reconnectCount, 30000);
                    console.log(fancy(`🔄 Reconnecting in ${delayTime/1000}s... (Attempt ${reconnectCount}/${MAX_RECONNECT})`));
                    setTimeout(start, delayTime);
                } else if (reconnectCount >= MAX_RECONNECT) {
                    console.log(fancy("❌ Max reconnection attempts reached"));
                }
            }
            
            // AUTO PAIRING FOR MULTIPLE DEVICES
            if (qr) {
                console.log(fancy("📱 QR Code generated for pairing"));
            }
        });

        // PAIRING ENDPOINT - ALLOWS MULTIPLE PAIRING
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
                
                console.log(fancy(`🔑 Generating pairing code for: ${cleanNum}`));
                const code = await conn.requestPairingCode(cleanNum);
                
                res.json({ 
                    success: true, 
                    code: code,
                    message: `8-digit code: ${code}`,
                    instructions: "Open WhatsApp → Settings → Linked Devices → Link a Device → Enter 8-digit Code"
                });
                
            } catch (err) {
                console.error("Pairing error:", err.message);
                
                // ALLOW MULTIPLE PAIRING - NO ERROR
                if (err.message.includes("already paired") || err.message.includes("duplicate")) {
                    res.json({ 
                        success: true, 
                        message: "Number already paired with bot",
                        note: "You can use the bot on multiple devices simultaneously"
                    });
                } else {
                    res.json({ success: false, error: "Failed: " + err.message });
                }
            }
        });

        // HEALTH CHECK FOR RENDER/RAILWAY
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
                name: conn.user?.name || 'Insidious',
                uptime: process.uptime(),
                sessions: countSessions(),
                version: config.version
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

        // GROUP PARTICIPANTS UPDATE
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

        console.log(fancy("🚀 AI Bot ready for pairing"));
        
    } catch (error) {
        console.error("Start error:", error.message);
        if (reconnectCount < MAX_RECONNECT) {
            reconnectCount++;
            const delayTime = Math.min(5000 * reconnectCount, 30000);
            console.log(fancy(`🔄 Restarting in ${delayTime/1000}s...`));
            setTimeout(start, delayTime);
        }
    }
}

// COUNT ACTIVE SESSIONS
function countSessions() {
    try {
        const sessionDir = 'insidious_session';
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            return files.filter(f => f.endsWith('.json')).length;
        }
        return 0;
    } catch {
        return 0;
    }
}

// START BOT
start();

// START SERVER
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy(`📊 Status: http://localhost:${PORT}/status`));
});

// KEEP ALIVE FOR RENDER/RAILWAY
const keepAlive = () => {
    const http = require('http');
    setInterval(() => {
        http.get(`http://localhost:${PORT}/health`, (res) => {
            if (res.statusCode === 200) {
                console.log(fancy(`❤️ Keep-alive ping successful`));
            }
        }).on('error', (err) => {
            console.log(fancy(`⚠️ Keep-alive failed: ${err.message}`));
        });
    }, 300000); // Every 5 minutes
};

keepAlive();

// AUTO RECONNECT IF DISCONNECTED
setInterval(() => {
    if (!isConnected && reconnectCount < MAX_RECONNECT) {
        console.log(fancy("🔌 Connection lost, attempting auto-reconnect..."));
        start();
    }
}, 60000); // Check every minute

module.exports = app;
