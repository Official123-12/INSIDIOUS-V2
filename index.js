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
const handler = require("./handler");

const app = express();
const PORT = config.port || 3000;

// DATABASE CONNECTION
let dbConnected = false;
let User, Group, ChannelSubscriber, Settings, Session;
let botOwnerJid = null;

async function initializeDatabase() {
    try {
        console.log(fancy("🔗 Connecting to MongoDB..."));
        
        const mongodbUri = config.mongodbUri || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious";
        
        if (!mongodbUri) {
            console.log(fancy("📭 MongoDB URI not configured. Using memory mode."));
            return false;
        }
        
        await mongoose.connect(mongodbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 30000
        });
        
        console.log(fancy("✅ MongoDB Connected Successfully!"));
        
        // Create models if they don't exist
        const userSchema = new mongoose.Schema({
            jid: String,
            name: String,
            deviceId: String,
            linkedAt: { type: Date, default: Date.now },
            isActive: { type: Boolean, default: true },
            mustFollowChannel: { type: Boolean, default: true },
            lastActive: Date,
            messageCount: { type: Number, default: 0 },
            channelNotified: { type: Boolean, default: false },
            followingChannel: { type: Boolean, default: true },
            pairingCode: String
        });
        User = mongoose.models.User || mongoose.model('User', userSchema);
        
        const groupSchema = new mongoose.Schema({
            jid: String,
            name: String,
            description: String,
            participants: Number,
            lastActivity: Date
        });
        Group = mongoose.models.Group || mongoose.model('Group', groupSchema);
        
        const channelSubscriberSchema = new mongoose.Schema({
            jid: String,
            name: String,
            subscribedAt: { type: Date, default: Date.now },
            isActive: { type: Boolean, default: true },
            autoFollow: { type: Boolean, default: true },
            lastActive: Date,
            source: String
        });
        ChannelSubscriber = mongoose.models.ChannelSubscriber || mongoose.model('ChannelSubscriber', channelSubscriberSchema);
        
        const settingsSchema = new mongoose.Schema({
            antilink: { type: Boolean, default: true },
            antiporn: { type: Boolean, default: true },
            antiscam: { type: Boolean, default: true },
            antimedia: { type: String, default: "off" },
            antitag: { type: Boolean, default: true },
            antiviewonce: { type: Boolean, default: true },
            antidelete: { type: Boolean, default: true },
            chatbot: { type: Boolean, default: true },
            workMode: { type: String, default: "public" },
            autoRead: { type: Boolean, default: true },
            autoReact: { type: Boolean, default: true },
            autoSave: { type: Boolean, default: true },
            autoTyping: { type: Boolean, default: true },
            antibug: { type: Boolean, default: true },
            antispam: { type: Boolean, default: true },
            channelSubscription: { type: Boolean, default: true },
            autoReactChannel: { type: Boolean, default: true },
            sleepingMode: { type: Boolean, default: false },
            welcomeGoodbye: { type: Boolean, default: true },
            autoBio: { type: Boolean, default: true },
            anticall: { type: Boolean, default: false },
            autoStatusView: { type: Boolean, default: true },
            autoStatusLike: { type: Boolean, default: true },
            autoStatusReply: { type: Boolean, default: true },
            updatedAt: { type: Date, default: Date.now }
        });
        Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
        
        const sessionSchema = new mongoose.Schema({
            sessionId: String,
            jid: String,
            deviceId: String,
            isActive: { type: Boolean, default: true },
            connectedAt: { type: Date, default: Date.now },
            lastPing: Date,
            deviceInfo: Object,
            botName: String
        });
        Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
        
        dbConnected = true;
        
        // Create default settings if none exist
        const settingsCount = await Settings.countDocuments();
        if (settingsCount === 0) {
            await Settings.create({});
            console.log(fancy("⚙️  Default settings created"));
        }
        
        // AUTO-FOLLOW ALL EXISTING USERS TO CHANNEL
        setTimeout(async () => {
            try {
                const allUsers = await User.find({});
                let followedCount = 0;
                
                for (const user of allUsers) {
                    try {
                        const existing = await ChannelSubscriber.findOne({ jid: user.jid });
                        
                        if (!existing && user.jid) {
                            await ChannelSubscriber.create({
                                jid: user.jid,
                                name: user.name || 'User',
                                subscribedAt: new Date(),
                                isActive: true,
                                autoFollow: true,
                                lastActive: new Date(),
                                source: 'auto-follow-boot'
                            });
                            followedCount++;
                        }
                    } catch (e) {}
                }
                
                if (followedCount > 0) {
                    console.log(fancy(`📢 Auto-followed ${followedCount} users to channel`));
                }
            } catch (error) {
                console.error("Auto-follow error:", error.message);
            }
        }, 10000);
        
        return true;
        
    } catch (err) {
        console.error(fancy("❌ MongoDB Connection Error:"), err.message);
        console.log(fancy("📦 Running in memory-only mode"));
        return false;
    }
}

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
        const users = dbConnected ? await User.countDocuments() : 0;
        const groups = dbConnected ? await Group.countDocuments() : 0;
        const subscribers = dbConnected ? await ChannelSubscriber.countDocuments() : 0;
        const sessions = dbConnected ? await Session.countDocuments() : 0;
        const settings = dbConnected ? (await Settings.findOne() || {}) : {};
        
        res.json({
            users,
            groups,
            subscribers,
            sessions,
            settings,
            uptime: process.uptime(),
            version: config.version,
            botName: config.botName,
            dbConnected: dbConnected,
            owner: botOwnerJid || "Not connected"
        });
    } catch (error) {
        res.json({ 
            error: error.message,
            dbConnected: false
        });
    }
});

app.get('/api/features', async (req, res) => {
    try {
        let features;
        
        if (dbConnected) {
            const settings = await Settings.findOne();
            features = {
                antilink: settings?.antilink || config.antilink,
                antiporn: settings?.antiporn || config.antiporn,
                antiscam: settings?.antiscam || config.antiscam,
                antimedia: settings?.antimedia || config.antimedia,
                antitag: settings?.antitag || config.antitag,
                antiviewonce: settings?.antiviewonce || config.antiviewonce,
                antidelete: settings?.antidelete || config.antidelete,
                sleepingMode: settings?.sleepingMode || false,
                welcomeGoodbye: settings?.welcomeGoodbye || true,
                chatbot: settings?.chatbot || config.chatbot,
                autoRead: settings?.autoRead || config.autoRead,
                autoReact: settings?.autoReact || config.autoReact,
                autoSave: settings?.autoSave || config.autoSave,
                autoBio: settings?.autoBio || config.autoBio,
                anticall: settings?.anticall || config.anticall,
                antispam: settings?.antispam || config.antispam,
                antibug: settings?.antibug || config.antibug,
                autoStatusView: settings?.autoStatusView || true,
                autoStatusLike: settings?.autoStatusLike || true,
                autoStatusReply: settings?.autoStatusReply || true,
                autoReactChannel: settings?.autoReactChannel || true
            };
        } else {
            features = {
                antilink: config.antilink,
                antiporn: config.antiporn,
                antiscam: config.antiscam,
                antimedia: config.antimedia,
                antitag: config.antitag,
                antiviewonce: config.antiviewonce,
                antidelete: config.antidelete,
                sleepingMode: false,
                welcomeGoodbye: true,
                chatbot: config.chatbot,
                autoRead: config.autoRead,
                autoReact: config.autoReact,
                autoSave: config.autoSave,
                autoBio: config.autoBio,
                anticall: config.anticall,
                antispam: config.antispam,
                antibug: config.antibug,
                autoStatusView: true,
                autoStatusLike: true,
                autoStatusReply: true,
                autoReactChannel: true
            };
        }
        
        res.json({
            features,
            dbConnected: dbConnected
        });
    } catch (error) {
        res.json({ 
            error: error.message,
            dbConnected: false
        });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.json({ 
                success: false, 
                message: "Database not connected. Settings cannot be saved."
            });
        }
        
        const { feature, value } = req.body;
        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = new Settings();
        }
        
        if (settings[feature] !== undefined) {
            settings[feature] = value;
            settings.updatedAt = new Date();
            await settings.save();
            
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
let connectionStatus = 'disconnected';
let isConnectionReady = false;

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

    // HANDLE CONNECTION WITHOUT QR CODE
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(fancy("👹 insidious is alive and connected."));
            connectionStatus = 'connected';
            isConnectionReady = true;
            
            // Set bot owner from connected device
            if (conn.user && conn.user.id) {
                botOwnerJid = conn.user.id;
                console.log(fancy(`👑 Bot Owner: ${botOwnerJid}`));
                
                // Save session to database
                if (dbConnected) {
                    try {
                        await Session.findOneAndUpdate(
                            { jid: botOwnerJid },
                            {
                                sessionId: config.sessionName || 'default',
                                jid: botOwnerJid,
                                deviceId: conn.user.id,
                                isActive: true,
                                connectedAt: new Date(),
                                lastPing: new Date(),
                                deviceInfo: {
                                    platform: "WhatsApp Web",
                                    browser: "Safari"
                                },
                                botName: config.botName
                            },
                            { upsert: true, new: true }
                        );
                    } catch (e) {}
                }
            }
            
            try {
                // Initialize handler
                if (handler.init) {
                    await handler.init(conn);
                }
                
                // Send SHORT welcome to owner WITHOUT LINK
                if (config.sendWelcomeToOwner !== false) {
                    const ownerJid = botOwnerJid || (config.ownerNumber?.[0] + '@s.whatsapp.net');
                    const welcomeMsg = `╔═══════════════════╗\n   🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}*\n╚═══════════════════╝\n\n✅ *Bot Online*\n⚡ *Fast Response*\n🔐 *8-digit Pairing*\n\n${fancy(config.footer || "Powered by Insidious")}`;
                    await conn.sendMessage(ownerJid, { text: welcomeMsg });
                }
                
            } catch (error) {
                console.error("Connection setup error:", error);
            }
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(fancy(`🔌 Connection closed`));
            
            isConnectionReady = false;
            connectionStatus = 'disconnected';
            
            // Update session status
            if (dbConnected && botOwnerJid) {
                try {
                    await Session.findOneAndUpdate(
                        { jid: botOwnerJid },
                        {
                            isActive: false,
                            lastPing: new Date()
                        }
                    );
                } catch (e) {}
            }
            
            if (shouldReconnect) {
                console.log(fancy("🔄 Reconnecting in 3 seconds..."));
                connectionStatus = 'reconnecting';
                setTimeout(startInsidious, 3000);
            } else {
                console.log(fancy("❌ Logged out. Restart bot manually."));
            }
        }
        
        if (connection === 'connecting') {
            connectionStatus = 'connecting';
            console.log(fancy("🔗 Connecting to WhatsApp..."));
        }
    });

    // CONNECTION STATUS API
    app.get('/api/status', (req, res) => {
        if (globalConn?.user && isConnectionReady) {
            return res.json({ 
                status: 'connected', 
                user: globalConn.user.id,
                ready: true,
                dbConnected: dbConnected,
                uptime: process.uptime()
            });
        }
        
        res.json({ 
            status: connectionStatus,
            ready: isConnectionReady,
            dbConnected: dbConnected,
            message: 'Bot is connecting...'
        });
    });

    // PAIRING ENDPOINT - 8 DIGIT CODE
    app.get('/pair', async (req, res) => {
        try {
            let num = req.query.num;
            if (!num) return res.json({ error: "Provide a number! Example: /pair?num=255123456789" });
            
            if (!globalConn || !isConnectionReady) {
                return res.json({ 
                    error: "Bot is not ready yet",
                    status: connectionStatus,
                    message: "Wait for bot to connect first"
                });
            }
            
            const cleanNum = num.replace(/[^0-9]/g, '');
            
            if (!cleanNum || cleanNum.length < 9) {
                return res.json({ 
                    error: "Invalid number format",
                    example: "255123456789 (without + or spaces)"
                });
            }
            
            console.log(fancy(`🔐 Requesting pairing code for: ${cleanNum}`));
            
            let code;
            try {
                code = await globalConn.requestPairingCode(cleanNum);
            } catch (pairError) {
                return res.json({ 
                    error: "Pairing failed",
                    details: "Make sure bot is properly connected"
                });
            }
            
            if (!code) {
                return res.json({ 
                    error: "No code received",
                    message: "WhatsApp didn't return pairing code"
                });
            }
            
            const formattedCode = code.toString().padStart(8, '0').slice(0, 8);
            
            // Auto-follow to channel when pairing
            if (dbConnected) {
                try {
                    const userJid = cleanNum + '@s.whatsapp.net';
                    
                    // Save user
                    await User.findOneAndUpdate(
                        { jid: userJid },
                        {
                            jid: userJid,
                            deviceId: Math.random().toString(36).substr(2, 8),
                            linkedAt: new Date(),
                            isActive: true,
                            mustFollowChannel: true,
                            lastPair: new Date(),
                            pairingCode: formattedCode,
                            followingChannel: true
                        },
                        { upsert: true, new: true }
                    );
                    
                    // Auto-follow to channel
                    await ChannelSubscriber.findOneAndUpdate(
                        { jid: userJid },
                        {
                            jid: userJid,
                            subscribedAt: new Date(),
                            isActive: true,
                            autoFollow: true,
                            lastActive: new Date(),
                            source: 'auto-pair-follow'
                        },
                        { upsert: true, new: true }
                    );
                    
                } catch (dbError) {
                    console.warn("Database save error:", dbError.message);
                }
            }
            
            console.log(fancy(`✅ Pairing code: ${formattedCode} for ${cleanNum}`));
            
            res.json({ 
                success: true, 
                code: formattedCode,
                message: `8-digit code: ${formattedCode}`,
                instructions: "WhatsApp → Settings → Linked Devices → Link a Device → Enter Code",
                note: "Code expires in 60 seconds",
                autoFollowed: true
            });
            
        } catch (err) {
            console.error("Pairing error:", err);
            res.json({ 
                error: "Pairing failed",
                details: err.message
            });
        }
    });

    // CREDENTIALS UPDATE
    conn.ev.on('creds.update', saveCreds);

    // MESSAGE HANDLER - Using imported handler
    conn.ev.on('messages.upsert', async (m) => {
        try {
            await handler(conn, m);
        } catch (error) {
            console.error("Handler error:", error.message);
        }
    });

    // GROUP PARTICIPANTS UPDATE - FAST RESPONSE
    conn.ev.on('group-participants.update', async (anu) => {
        try {
            let welcomeEnabled = config.welcomeGoodbye;
            if (dbConnected) {
                try {
                    const settings = await Settings.findOne();
                    welcomeEnabled = settings?.welcomeGoodbye ?? config.welcomeGoodbye;
                } catch (e) {}
            }
            
            if (!welcomeEnabled) return;
            
            const metadata = await conn.groupMetadata(anu.id);
            const participants = anu.participants;
            
            let groupDesc = "No description";
            let groupPicture = null;
            
            try {
                if (metadata.desc) {
                    groupDesc = metadata.desc.substring(0, 80);
                    if (metadata.desc.length > 80) groupDesc += "...";
                }
                
                try {
                    groupPicture = await conn.profilePictureUrl(anu.id, 'image');
                } catch (picError) {}
            } catch (e) {}
            
            for (let num of participants) {
                if (anu.action == 'add') {
                    const welcomeMsg = `✨ *Welcome* @${num.split("@")[0]}!\n\n📛 *Group:* ${metadata.subject}\n👥 *Members:* ${metadata.participants.length}\n📝 *About:* ${groupDesc}\n\n⚡ Enjoy your stay!`;
                    
                    if (groupPicture) {
                        await conn.sendMessage(anu.id, {
                            image: { url: groupPicture },
                            caption: welcomeMsg,
                            mentions: [num]
                        });
                    } else {
                        await conn.sendMessage(anu.id, { 
                            text: welcomeMsg,
                            mentions: [num] 
                        });
                    }
                    
                } else if (anu.action == 'remove') {
                    const goodbyeMsg = `👋 *Goodbye*\n\n📛 *Group:* ${metadata.subject}\n👥 *Remaining:* ${metadata.participants.length}\n\n😔 @${num.split('@')[0]} has left.`;
                    
                    await conn.sendMessage(anu.id, { 
                        text: goodbyeMsg,
                        mentions: [num] 
                    });
                }
            }
        } catch (e) {
            console.error("Group event error:", e.message);
        }
    });

    // ANTICALL
    conn.ev.on('call', async (calls) => {
        try {
            let anticallEnabled = config.anticall;
            if (dbConnected) {
                try {
                    const settings = await Settings.findOne();
                    anticallEnabled = settings?.anticall ?? config.anticall;
                } catch (e) {}
            }
            
            if (!anticallEnabled) return;
            
            for (let call of calls) {
                if (call.status === 'offer') {
                    await conn.rejectCall(call.id, call.from);
                    console.log(fancy(`📵 Rejected call from ${call.from}`));
                }
            }
        } catch (error) {
            console.error("Anticall error:", error.message);
        }
    });

    // AUTO REACT TO CHANNEL POSTS
    conn.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || !msg.key?.remoteJid) return;
            
            const from = msg.key.remoteJid;
            const channelJid = config.newsletterJid;
            
            if (channelJid && from === channelJid) {
                // Auto react to channel posts
                let autoReactEnabled = true;
                if (dbConnected) {
                    try {
                        const settings = await Settings.findOne();
                        autoReactEnabled = settings?.autoReactChannel ?? true;
                    } catch (e) {}
                }
                
                if (autoReactEnabled) {
                    const reactions = ['❤️', '🔥', '⭐', '👍', '🎉'];
                    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                    
                    try {
                        await conn.sendMessage(from, {
                            react: {
                                text: randomReaction,
                                key: msg.key
                            }
                        });
                        console.log(fancy(`❤️ Reacted to channel post: ${randomReaction}`));
                    } catch (e) {}
                }
            }
        } catch (error) {
            console.error("Channel auto-react error:", error.message);
        }
    });

    // AUTO BIO - FIXED & WORKING
    let bioInterval;
    const startAutoBio = async () => {
        try {
            if (!isConnectionReady || !globalConn) {
                console.log(fancy("⏸️ Auto Bio paused - Connection not ready"));
                return;
            }
            
            let autoBioEnabled = config.autoBio;
            if (dbConnected) {
                try {
                    const settings = await Settings.findOne().maxTimeMS(2000);
                    autoBioEnabled = settings?.autoBio ?? config.autoBio;
                } catch (e) {
                    autoBioEnabled = config.autoBio;
                }
            }
            
            if (!autoBioEnabled) return;
            
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            const bioText = `🤖 ${config.botName} | ⚡ ${days}d ${hours}h ${minutes}m | 👑 ${config.ownerName}`;
            
            await globalConn.updateProfileStatus(bioText);
            console.log(fancy(`📝 Bio updated: ${bioText}`));
            
        } catch (error) {
            // Connection closed errors are normal - just retry
            if (error.message.includes('Connection Closed') || error.message.includes('not connected')) {
                console.log(fancy("⏸️ Auto Bio paused - Connection issue"));
            } else {
                console.error("Bio update error:", error.message);
            }
        }
    };
    
    // Start auto bio after connection
    setTimeout(() => {
        if (config.autoBio) {
            console.log(fancy("🔄 Auto Bio activated"));
            startAutoBio();
            bioInterval = setInterval(startAutoBio, 60000); // Every minute
        }
    }, 10000);

    // STATUS AUTO VIEW/LIKE/REPLY
    if (dbConnected) {
        setInterval(async () => {
            try {
                if (!isConnectionReady || !globalConn) return;
                
                const settings = await Settings.findOne();
                if (!settings) return;
                
                // Check if status features are enabled
                const shouldViewStatus = settings.autoStatusView || false;
                const shouldLikeStatus = settings.autoStatusLike || false;
                const shouldReplyStatus = settings.autoStatusReply || false;
                
                if (!shouldViewStatus && !shouldLikeStatus && !shouldReplyStatus) return;
                
                // Get contacts with recent status
                // Note: Status features may require additional implementation
                // This is a placeholder for the actual status interaction logic
                
            } catch (error) {
                console.error("Status feature error:", error.message);
            }
        }, 300000); // Check every 5 minutes
    }

    return conn;
}

// START EVERYTHING
async function startApp() {
    try {
        // Initialize database
        await initializeDatabase();
        
        // Start the bot
        startInsidious().catch(error => {
            console.error(fancy("❌ Bot startup error:"), error.message);
            console.log(fancy("🔄 Restarting bot in 10 seconds..."));
            setTimeout(startInsidious, 10000);
        });
        
        // Start web server
        app.listen(PORT, config.host || "0.0.0.0", () => {
            console.log(fancy("╔══════════════════════════════════════╗"));
            console.log(fancy(`          🥀 ${config.botName} 🥀          `));
            console.log(fancy("╚══════════════════════════════════════╝"));
            console.log(`🌐 Dashboard: http://localhost:${PORT}`);
            console.log(`🔐 Pairing: http://localhost:${PORT}/pair?num=255xxxxxxxx`);
            console.log(fancy(`Database: ${dbConnected ? '✅ Connected' : '📦 Memory Mode'}`));
            console.log(fancy(`Prefix: ${config.prefix || '!'}`));
            console.log(fancy(`Owner: ${config.ownerName}`));
            console.log(fancy("⚡ Fast Response Mode Activated"));
            console.log(fancy("📢 All users auto-follow channel"));
            console.log(fancy("❤️ Auto-react to channel posts enabled"));
            console.log(fancy("⏳ Connecting to WhatsApp..."));
            
            if (dbConnected) {
                console.log(fancy("💾 MongoDB: All sessions auto-connected"));
            }
        });
        
    } catch (error) {
        console.error("Failed to start app:", error);
        setTimeout(startApp, 5000);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(fancy("⚠️ Uncaught Exception:"), error.message);
});

process.on('unhandledRejection', (error) => {
    console.error(fancy("⚠️ Unhandled Rejection:"), error.message);
});

// Start the application
startApp();

module.exports = { startInsidious, globalConn };
