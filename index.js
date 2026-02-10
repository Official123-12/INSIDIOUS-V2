const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");
const config = require("./config");
const { fancy } = require("./lib/font");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE CONNECTION - SILENT MODE
console.log(fancy("🔗 Connecting to database..."));
const MONGODB_URI = "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 10000,
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
                autoStatus: settings.autoStatus || config.autoStatus || false,
                autoRead: settings.autoRead || config.autoRead || true,
                autoReact: settings.autoReact || config.autoReact || false,
                autoSave: settings.autoSave || config.autoSave || false,
                autoBio: settings.autoBio || config.autoBio || true,
                anticall: settings.anticall || config.anticall || true,
                downloadStatus: settings.downloadStatus || config.downloadStatus || false,
                antispam: settings.antispam || config.antispam || true,
                antibug: settings.antibug || config.antibug || true
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
            const { connection, qr } = update;
            
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS V2.1.1 ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                
                // SIMPLE CONNECTION MESSAGE TO OWNER
                try {
                    const botId = conn.user?.id || "bot";
                    const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase();
                    
                    const connectionMsg = `
╭─── • 🥀 • ───╮
   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🔐 Session: ${botId.substring(0, 10)}...
🆔 Code: ${uniqueCode}
👥 User: ${conn.user?.name || "Insidious"}
🕐 Time: ${new Date().toLocaleTimeString()}

${fancy("Ready to serve...")}`;
                    
                    // Send to bot owner
                    if (config.ownerNumber) {
                        const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                        await conn.sendMessage(ownerJid, { text: connectionMsg });
                    }
                    
                } catch (e) {
                    console.log("Connection message error:", e.message);
                }
            }
            
            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(fancy("🔄 Reconnecting in 5 seconds..."));
                    setTimeout(start, 5000);
                }
            }
        });

        // PAIRING ENDPOINT
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
                    message: `Pairing code: ${code}`,
                    instructions: "Open WhatsApp → Settings → Linked Devices → Link a Device → Enter Code"
                });
                
            } catch (err) {
                console.error("Pairing error:", err.message);
                res.json({ error: "Failed: " + err.message });
            }
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

        // CONNECTION STATUS API
        app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                bot: 'Insidious V2', 
                database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                connection: conn.user ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            });
        });

        console.log(fancy("🚀 Bot ready for pairing"));
        
    } catch (error) {
        console.error("Start error:", error.message);
        setTimeout(start, 10000);
    }
}

// START BOT
start();

// START SERVER
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
});

module.exports = app;
