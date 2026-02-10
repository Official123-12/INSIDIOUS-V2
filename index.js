const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const { fancy } = require("./lib/font");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE CONNECTION
console.log(fancy("🔗 Connecting to database..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

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
        const { User, Group, Settings } = require('./database/models');
        const users = await User.countDocuments();
        const groups = await Group.countDocuments();
        const settings = await Settings.findOne();
        
        res.json({
            success: true,
            users,
            groups,
            settings: settings || {},
            uptime: process.uptime(),
            version: "2.1.1",
            botName: "INSIDIOUS"
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: "Database not available", 
            stats: { users: 0, groups: 0 } 
        });
    }
});

let globalConn = null;

async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('insidious_session');

        const conn = makeWASocket({
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
            const { connection } = update;
            
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS V2.1.1 ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                
                // Save session
                try {
                    const { User } = require('./database/models');
                    const botUser = await User.findOne({ jid: conn.user.id });
                    if (!botUser) {
                        await new User({
                            jid: conn.user.id,
                            name: conn.user.name,
                            isActive: true,
                            linkedAt: new Date()
                        }).save();
                    }
                } catch (e) {}
                
                // Connection message
                try {
                    const config = require('./config');
                    const connectionMsg = `
╭─── • 🥀 • ───╮
   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
👤 User: ${conn.user?.name || "Insidious"}
🆔 ID: ${conn.user?.id?.split(':')[0] || "Unknown"}
🕐 Time: ${new Date().toLocaleTimeString()}

⚙️ *Features Ready:*
🤖 AI Chatbot: ✅
👁️ Anti-Viewonce: ✅
🗑️ Anti-Delete: ✅
📱 Auto Recording: ✅
💕 All Anti Features: ✅

Ready with love & feelings... ❤️`;
                    
                    // Send to bot owner
                    if (config.ownerNumber && config.ownerNumber.length > 0) {
                        const ownerJid = config.ownerNumber[0] + '@s.whatsapp.net';
                        await conn.sendMessage(ownerJid, { text: connectionMsg });
                    }
                    
                } catch (e) {}
                
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
                
                try {
                    const code = await conn.requestPairingCode(cleanNum);
                    res.json({ 
                        success: true, 
                        code: code,
                        message: `8-digit code: ${code}`,
                        instructions: "Open WhatsApp → Settings → Linked Devices → Link a Device → Enter 8-digit Code"
                    });
                } catch (err) {
                    if (err.message.includes("already paired") || err.message.includes("duplicate")) {
                        res.json({ 
                            success: true, 
                            message: "Number already paired with bot",
                            alreadyPaired: true 
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

        console.log(fancy("🚀 INSIDIOUS ready for pairing (8-digit code)"));
        
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
    console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
});

// Keep alive
const keepAlive = () => {
    const http = require('http');
    setInterval(() => {
        http.get(`http://localhost:${PORT}`);
    }, 300000);
};

keepAlive();

module.exports = app;
