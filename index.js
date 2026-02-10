// Ongeza hii mstari wa kwanza kabisa
require('dotenv').config();

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
const axios = require("axios");
const cron = require("node-cron");
const { fancy } = require("./lib/font");
const config = require("./config");
const { User, Group, ChannelSubscriber, Settings } = require('./database/models');

const app = express();
const PORT = process.env.PORT || 3000;

// HAKIKISHA DATABASE CONNECTION - NIMEONGEZA RETRY LOGIC
async function connectDatabase() {
    try {
        // Hakikisha connection string iko sawa
        const mongoURI = config.mongodb || process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";
        
        console.log(fancy("🔗 Connecting to MongoDB Atlas..."));
        
        // Ongeza options za connection
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };
        
        await mongoose.connect(mongoURI, options);
        console.log(fancy("✅ MongoDB Atlas connected successfully!"));
        
        // Set up connection event handlers
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log(fancy('MongoDB disconnected'));
        });
        
    } catch (err) {
        console.error(fancy("❌ MongoDB connection failed:"));
        console.error("Error details:", err.message);
        console.log(fancy("🔄 Retrying in 5 seconds..."));
        
        // Retry after 5 seconds
        setTimeout(connectDatabase, 5000);
    }
}

// Anza kusajili database
connectDatabase();

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
        const groups = await Group.countDocuments();
        const subscribers = await ChannelSubscriber.countDocuments();
        const settings = await Settings.findOne();
        
        res.json({
            users,
            groups,
            subscribers,
            settings: settings || {},
            uptime: process.uptime(),
            version: config.version,
            botName: config.botName
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.get('/api/features', async (req, res) => {
    try {
        const settings = await Settings.findOne() || new Settings();
        res.json({
            features: {
                antilink: settings.antilink,
                antiporn: settings.antiporn,
                antiscam: settings.antiscam,
                antimedia: settings.antimedia,
                antitag: settings.antitag,
                antiviewonce: settings.antiviewonce,
                antidelete: settings.antidelete,
                sleepingMode: settings.sleepingMode,
                welcomeGoodbye: settings.welcomeGoodbye,
                activeMembers: settings.activeMembers,
                autoblockCountry: settings.autoblockCountry,
                chatbot: settings.chatbot,
                autoStatus: settings.autoStatus,
                autoRead: settings.autoRead,
                autoReact: settings.autoReact,
                autoSave: settings.autoSave,
                autoBio: settings.autoBio,
                anticall: settings.anticall,
                downloadStatus: settings.downloadStatus,
                antispam: settings.antispam,
                antibug: settings.antibug
            }
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { feature, value } = req.body;
        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = new Settings();
        }
        
        if (settings[feature] !== undefined) {
            settings[feature] = value;
            await settings.save();
            
            config[feature] = value;
            
            res.json({ 
                success: true, 
                message: `${feature} set to ${value}` 
            });
        } else {
            res.json({ 
                success: false, 
                message: `Feature ${feature} not found` 
            });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

let globalConn = null;
let qrCodeData = null;

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
            console.log(fancy("👹 insidious is alive and connected."));
            qrCodeData = null;
            
            try {
                // Initialize settings if not exist
                let settings = await Settings.findOne();
                if (!settings) {
                    settings = new Settings();
                    await settings.save();
                }
                
                // Send minimal welcome to owner
                if (config.sendWelcomeToOwner) {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ Bot is online!\n📊 Dashboard: http://localhost:${PORT}\n\n${fancy(config.footer)}`;
                    await conn.sendMessage(ownerJid, { text: welcomeMsg });
                }
                
            } catch (error) {
                console.error("Connection setup error:", error);
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

    // PAIRING ENDPOINT
    app.get('/pair', async (req, res) => {
        let num = req.query.num;
        if (!num) return res.json({ error: "Provide a number!" });
        
        try {
            const cleanNum = num.replace(/[^0-9]/g, '');
            
            // Generate pairing code
            const code = await conn.requestPairingCode(cleanNum);
            
            // Save/Update user
            await User.findOneAndUpdate(
                { jid: cleanNum + '@s.whatsapp.net' },
                {
                    jid: cleanNum + '@s.whatsapp.net',
                    deviceId: Math.random().toString(36).substr(2, 8),
                    linkedAt: new Date(),
                    isActive: true,
                    mustFollowChannel: true,
                    lastPair: new Date()
                },
                { upsert: true, new: true }
            );
            
            res.json({ 
                success: true, 
                code: code,
                message: "Scan code in WhatsApp Linked Devices"
            });
            
        } catch (err) {
            console.error("Pairing error:", err);
            res.json({ 
                error: "Pairing failed. Try again.",
                details: err.message 
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

    // GROUP PARTICIPANTS UPDATE (IMPROVED WITH GROUP INFO)
    conn.ev.on('group-participants.update', async (anu) => {
        try {
            const settings = await Settings.findOne();
            if (!settings?.welcomeGoodbye) return;
            
            const metadata = await conn.groupMetadata(anu.id);
            const participants = anu.participants;
            
            // Get group description
            const groupDesc = metadata.desc || "No description";
            
            // Try to get group picture
            let groupPicture = null;
            try {
                groupPicture = await conn.profilePictureUrl(anu.id, 'image').catch(async () => {
                    return await conn.profilePictureUrl(anu.id, 'preview').catch(() => null);
                });
            } catch (e) {
                console.log("No group picture found");
            }

            for (let num of participants) {
                if (anu.action == 'add') {
                    const welcomeMsg = `╭─── • 🥀 • ───╮\n   𝙒𝙀𝙇𝘾𝙊𝙈𝙀 𝙏𝙊 𝙏𝙃𝙀 𝙁𝙐𝙍𝙏𝙃𝙀𝙍\n╰─── • 🥀 • ───╯\n\n🎉 Welcome @${num.split("@")[0]}!\n\n📛 *Group:* ${metadata.subject}\n👥 *Members:* ${metadata.participants.length}\n📝 *Description:* ${groupDesc}\n\n🥀 "${fancy("A new soul has entered the void")}"\n\n${fancy(config.footer)}`;
                    
                    // Send message with group image if available
                    if (groupPicture) {
                        try {
                            const imageResponse = await axios.get(groupPicture, { responseType: 'arraybuffer' });
                            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                            
                            await conn.sendMessage(anu.id, { 
                                image: imageBuffer,
                                caption: welcomeMsg,
                                mentions: [num]
                            });
                        } catch (e) {
                            await conn.sendMessage(anu.id, { 
                                text: welcomeMsg,
                                mentions: [num] 
                            });
                        }
                    } else {
                        await conn.sendMessage(anu.id, { 
                            text: welcomeMsg,
                            mentions: [num] 
                        });
                    }
                    
                } else if (anu.action == 'remove') {
                    const goodbyeMsg = `╭─── • 🥀 • ───╮\n   𝙎𝙊𝙐𝙇 𝙃𝘼𝙎 𝙇𝙀𝙁𝙏 𝙏𝙃𝙀 𝙑𝙊𝙄𝘿\n╰─── • 🥀 • ───╯\n\n👋 @${num.split('@')[0]} has left the group\n\n📛 *Group:* ${metadata.subject}\n📝 *Description:* ${groupDesc}\n\n🥀 "${fancy("Another soul departs")}"`;
                    
                    // Send message with group image if available
                    if (groupPicture) {
                        try {
                            const imageResponse = await axios.get(groupPicture, { responseType: 'arraybuffer' });
                            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                            
                            await conn.sendMessage(anu.id, { 
                                image: imageBuffer,
                                caption: goodbyeMsg,
                                mentions: [num]
                            });
                        } catch (e) {
                            await conn.sendMessage(anu.id, { 
                                text: goodbyeMsg,
                                mentions: [num] 
                            });
                        }
                    } else {
                        await conn.sendMessage(anu.id, { 
                            text: goodbyeMsg,
                            mentions: [num] 
                        });
                    }
                }
            }
        } catch (e) { 
            console.error("Group event error:", e);
        }
    });

    // ANTICALL
    conn.ev.on('call', async (calls) => {
        try {
            const settings = await Settings.findOne();
            if (!settings?.anticall) return;
            
            for (let call of calls) {
                if (call.status === 'offer') {
                    await conn.rejectCall(call.id, call.from);
                    console.log(fancy(`📵 Rejected call from ${call.from}`));
                }
            }
        } catch (error) {
            console.error("Anticall error:", error);
        }
    });

    // SLEEPING MODE
    if (config.sleepStart && config.sleepEnd) {
        const [startH, startM] = config.sleepStart.split(':');
        const [endH, endM] = config.sleepEnd.split(':');

        cron.schedule(`${startM} ${startH} * * *`, async () => {
            try {
                const settings = await Settings.findOne();
                if (!settings?.sleepingMode) return;
                
                const groups = await Group.find({});
                for (let group of groups) {
                    try {
                        await conn.groupSettingUpdate(group.jid, 'announcement');
                    } catch (e) {}
                }
                console.log(fancy("💤 Sleeping mode activated"));
            } catch (error) {
                console.error("Sleep mode error:", error);
            }
        });

        cron.schedule(`${endM} ${endH} * * *`, async () => {
            try {
                const settings = await Settings.findOne();
                if (!settings?.sleepingMode) return;
                
                const groups = await Group.find({});
                for (let group of groups) {
                    try {
                        await conn.groupSettingUpdate(group.jid, 'not_announcement');
                    } catch (e) {}
                }
                console.log(fancy("🌅 Awake mode activated"));
            } catch (error) {
                console.error("Awake mode error:", error);
            }
        });
    }

    // AUTO BIO
    if (config.autoBio) {
        setInterval(async () => {
            try {
                const settings = await Settings.findOne();
                if (!settings?.autoBio) return;
                
                const uptime = process.uptime();
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor((uptime % 86400) / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                
                const bio = `🤖 ${config.botName} | ⚡${days}d ${hours}h ${minutes}m | 👑${config.ownerName}`;
                await conn.updateProfileStatus(bio);
            } catch (error) {
                console.error("Auto bio error:", error);
            }
        }, 60000);
    }

    return conn;
}

// START BOT AFTER DB CONNECTION
setTimeout(() => {
    startInsidious().catch(console.error);
}, 2000); // Delay kidogo kwa ajili ya DB connection

// Start web server
app.listen(PORT, () => console.log(fancy(`🌐 Dashboard running on port ${PORT}`)));

module.exports = { startInsidious, globalConn };
