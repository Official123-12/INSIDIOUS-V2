const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const { fancy } = require("./lib/font");
const config = require("./config");
const { User } = require('./database/models');

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE CONNECTION
mongoose.connect(config.mongodb, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log(fancy("🥀 Database connected")))
    .catch(err => console.error("DB Error:", err));

// MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WEB ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API ENDPOINTS
app.get('/api/stats', async (req, res) => {
    try {
        const users = await User.countDocuments();
        res.json({
            users,
            uptime: process.uptime(),
            version: config.version,
            botName: config.botName
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

let globalConn = null;

async function startInsidious() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: true,
        getMessage: async (key) => ({ conversation: "message deleted" })
    });

    globalConn = conn;

    // HANDLE CONNECTION
    conn.ev.on('connection.update', async (update) => {
        const { connection } = update;
        
        if (connection === 'open') {
            console.log(fancy("✅ Bot connected successfully"));
            
            // Send welcome to owner (once only)
            if (config.sendWelcomeToOwner) {
                const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ Bot is online!\n📊 Dashboard: http://localhost:${PORT}\n\n${fancy(config.footer)}`;
                await conn.sendMessage(ownerJid, { text: welcomeMsg });
                config.sendWelcomeToOwner = false; // Send only once
            }
        }
        
        if (connection === 'close') {
            const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(fancy("🔄 Reconnecting..."));
                setTimeout(startInsidious, 5000);
            }
        }
    });

    // SIMPLE PAIRING ENDPOINT - ONLY 8-DIGIT CODE
    app.get('/pair', async (req, res) => {
        let num = req.query.num;
        if (!num) return res.json({ error: "Provide a number!" });
        
        try {
            const cleanNum = num.replace(/[^0-9]/g, '');
            
            // Generate pairing code
            const code = await conn.requestPairingCode(cleanNum);
            
            // Save user
            await User.findOneAndUpdate(
                { jid: cleanNum + '@s.whatsapp.net' },
                {
                    jid: cleanNum + '@s.whatsapp.net',
                    deviceId: Math.random().toString(36).substr(2, 8),
                    linkedAt: new Date(),
                    isActive: true,
                    lastPair: new Date()
                },
                { upsert: true, new: true }
            );
            
            res.json({ 
                success: true, 
                code: code,
                message: "Enter this 8-digit code in WhatsApp Linked Devices"
            });
            
        } catch (err) {
            console.error("Pairing error:", err);
            res.json({ 
                error: "Failed to generate code. Make sure number is valid."
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // MESSAGE HANDLER
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        // Pass to Master Handler
        require('./handler')(conn, m);
    });

    // GROUP PARTICIPANTS UPDATE
    conn.ev.on('group-participants.update', async (anu) => {
        try {
            if (!config.welcomeGoodbye) return;
            
            const metadata = await conn.groupMetadata(anu.id);
            const participants = anu.participants;
            
            for (let num of participants) {
                if (anu.action == 'add') {
                    const welcomeMsg = `╭── • 🥀 • ──╮\n  Welcome\n╰── • 🥀 • ──╯\n\nWelcome @${num.split("@")[0]} to ${metadata.subject}`;
                    
                    await conn.sendMessage(anu.id, { 
                        text: welcomeMsg,
                        mentions: [num] 
                    });
                    
                } else if (anu.action == 'remove') {
                    const goodbyeMsg = `╭── • 🥀 • ──╮\n  Goodbye\n╰── • 🥀 • ──╯\n\n@${num.split('@')[0]} has left the group`;
                    await conn.sendMessage(anu.id, { 
                        text: goodbyeMsg,
                        mentions: [num] 
                    });
                }
            }
        } catch (e) { 
            // Silent fail
        }
    });

    // ANTICALL - SIMPLE
    conn.ev.on('call', async (calls) => {
        try {
            if (!config.anticall) return;
            
            for (let call of calls) {
                if (call.status === 'offer') {
                    await conn.rejectCall(call.id, call.from);
                    console.log(fancy(`Rejected call from ${call.from}`));
                }
            }
        } catch (error) {
            // Silent fail
        }
    });

    return conn;
}

// Start the bot
startInsidious().catch(console.error);

// Start web server
app.listen(PORT, () => console.log(`🌐 Web panel: http://localhost:${PORT}`));

module.exports = { startInsidious, globalConn };
