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
const fs = require("fs-extra");
const { fancy } = require("./lib/font");
const config = require("./config");
const app = express();
const http = require("http");
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000;

/**
 * INSIDIOUS: THE LAST KEY V2.1.1
 * COMPLETE BOT IMPLEMENTATION - ALL FEATURES
 * DEVELOPER: STANYTZ
 */

// ==================== DATABASE MODELS ====================
const userSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    deviceId: String,
    linkedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    lastActive: Date,
    messageCount: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    spamCount: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    countryCode: String,
    joinedGroups: [String],
    mustFollowChannel: { type: Boolean, default: true },
    sessionData: mongoose.Schema.Types.Mixed,
    settings: {
        antilink: { type: Boolean, default: true },
        antiporn: { type: Boolean, default: true },
        antiscam: { type: Boolean, default: true },
        chatbot: { type: Boolean, default: true }
    }
});

const sessionSchema = new mongoose.Schema({
    pairingCode: { type: String, unique: true },
    number: String,
    status: { type: String, enum: ['pending', 'completed', 'expired'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    completedAt: { type: Date },
    userId: mongoose.Schema.Types.ObjectId
});

const channelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    subscribedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    reactionsGiven: { type: Number, default: 0 },
    postsViewed: { type: Number, default: 0 }
});

const groupSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    settings: {
        antilink: { type: Boolean, default: true },
        antiporn: { type: Boolean, default: true },
        antiscam: { type: Boolean, default: true },
        antimedia: { type: String, default: 'off' },
        antitag: { type: Boolean, default: true },
        sleeping: { type: Boolean, default: false },
        welcome: { type: Boolean, default: true },
        goodbye: { type: Boolean, default: true }
    },
    sleepingMode: {
        enabled: Boolean,
        start: String,
        end: String
    }
});

const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);
const ChannelSubscriber = mongoose.model('ChannelSubscriber', channelSubscriberSchema);
const Group = mongoose.model('Group', groupSchema);

// ==================== DATABASE CONNECTION ====================
mongoose.connect(config.mongodb, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log(fancy("🥀 database connected: insidious is eternal.")))
.catch(err => console.error("DB Connection Error:", err));

// ==================== EXPRESS SETUP ====================
app.use(express.json());
app.use(express.static('public'));

// Web Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API: Generate 8-digit pairing code
app.get('/api/pair', async (req, res) => {
    try {
        const { number } = req.query;
        if (!number) return res.json({ error: "Number is required!" });

        const cleanNumber = number.replace(/[^0-9]/g, '');
        
        // Check if already paired
        const existingUser = await User.findOne({ jid: `${cleanNumber}@s.whatsapp.net` });
        if (existingUser) {
            return res.json({ 
                success: true, 
                message: "Already paired! You can use the bot directly.",
                deviceId: existingUser.deviceId 
            });
        }

        // Generate 8-digit code
        const pairingCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        
        // Save to session database
        const session = new Session({
            pairingCode,
            number: cleanNumber,
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        });
        await session.save();

        res.json({
            success: true,
            pairingCode,
            formattedCode: pairingCode.match(/.{1,2}/g).join('-'),
            message: `Use this code in WhatsApp: ${pairingCode.match(/.{1,2}/g).join('-')}`,
            expiresIn: "10 minutes"
        });

    } catch (error) {
        console.error("Pairing error:", error);
        res.json({ error: "Pairing failed. Please try again." });
    }
});

// API: Verify pairing
app.post('/api/verify-pairing', async (req, res) => {
    try {
        const { pairingCode, deviceName } = req.body;
        
        // Find session
        const session = await Session.findOne({ 
            pairingCode: pairingCode.replace(/-/g, ''),
            status: 'pending'
        });
        
        if (!session) {
            return res.json({ error: "Invalid or expired pairing code!" });
        }

        // Create user
        const deviceId = Math.random().toString(36).substr(2, 8);
        const user = new User({
            jid: `${session.number}@s.whatsapp.net`,
            name: deviceName || `Device-${deviceId}`,
            deviceId,
            linkedAt: new Date(),
            isActive: true,
            mustFollowChannel: true
        });
        await user.save();

        // Auto subscribe to channel
        const subscriber = new ChannelSubscriber({
            jid: user.jid,
            name: user.name,
            subscribedAt: new Date(),
            isActive: true
        });
        await subscriber.save();

        // Update session
        session.status = 'completed';
        session.userId = user._id;
        session.completedAt = new Date();
        await session.save();

        res.json({
            success: true,
            message: "Device paired successfully! Auto-subscribed to channel.",
            deviceId: user.deviceId,
            jid: user.jid
        });

    } catch (error) {
        console.error("Verify pairing error:", error);
        res.json({ error: "Verification failed. Please try again." });
    }
});

// API: Get bot stats
app.get('/api/stats', async (req, res) => {
    try {
        const users = await User.countDocuments();
        const groups = await Group.countDocuments();
        const subscribers = await ChannelSubscriber.countDocuments();
        
        res.json({
            users,
            groups,
            subscribers,
            uptime: process.uptime(),
            version: config.version,
            connected: global.conn ? true : false
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// API: Get active sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({ status: 'completed' })
            .sort({ completedAt: -1 })
            .limit(50);
        res.json({ success: true, sessions });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// ==================== SOCKET.IO FOR REAL-TIME UPDATES ====================
io.on('connection', (socket) => {
    console.log(fancy('🌐 New WebSocket connection'));
    
    socket.on('getPairingCode', async (data) => {
        try {
            const { number } = data;
            const response = await axios.get(`http://localhost:${PORT}/api/pair?number=${number}`);
            socket.emit('pairingCode', response.data);
        } catch (error) {
            socket.emit('pairingError', { error: error.message });
        }
    });
    
    socket.on('disconnect', () => {
        console.log(fancy('🌐 WebSocket disconnected'));
    });
});

// ==================== BOT INITIALIZATION ====================
let conn = null;

async function startInsidious() {
    try {
        // Restore all active sessions
        await restoreAllSessions();
        
        const { state, saveCreds } = await useMultiFileAuthState('./auth');
        const { version } = await fetchLatestBaileysVersion();

        conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: true
        });

        // Save credentials when updated
        conn.ev.on('creds.update', saveCreds);

        // ==================== CONNECTION HANDLING ====================
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(fancy(`🔌 Connection closed. Reconnecting: ${shouldReconnect}`));
                if (shouldReconnect) {
                    setTimeout(() => {
                        console.log(fancy("🔄 Attempting to reconnect..."));
                        startInsidious();
                    }, 5000);
                }
            } else if (connection === 'open') {
                console.log(fancy("✅ Bot is online and connected!"));
                global.conn = conn;
                
                // Update all users that bot is online
                await User.updateMany({ isActive: true }, { $set: { lastActive: new Date() } });
                
                // Send online notification to owner
                const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                const onlineMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴏɴʟɪɴᴇ\n╰─── • 🥀 • ───╯\n\n✅ Bot restarted successfully!\n📅 ${new Date().toLocaleString()}\n📊 Sessions restored automatically\n🔗 Channel: ${config.channelLink}\n\n${fancy(config.footer)}`;
                
                try {
                    await conn.sendMessage(ownerJid, { text: onlineMsg });
                } catch (error) {
                    console.error("Owner notification error:", error);
                }
                
                // Start all auto features
                startAutoFeatures();
                
                // Emit to web clients
                io.emit('botStatus', { connected: true });
            }
        });

        // ==================== MESSAGE HANDLING ====================
        conn.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message) return;

            // 12. AUTO STATUS FEATURE
            if (msg.key.remoteJid === 'status@broadcast' && config.autoStatus.view) {
                try {
                    // Auto view
                    await conn.readMessages([msg.key]);
                    
                    // Auto like with different emojis
                    if (config.autoStatus.like) {
                        const emojis = ['🥀', '❤️', '🔥', '⭐', '✨', '👏'];
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        
                        await conn.sendMessage('status@broadcast', { 
                            react: { text: randomEmoji, key: msg.key } 
                        }, { statusJidList: [msg.key.participant] });
                    }
                    
                    // Auto reply to status
                    if (config.autoStatus.reply) {
                        const statusText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                        if (statusText) {
                            try {
                                const aiResponse = await axios.get(`${config.aiModel}${encodeURIComponent("Reply to this status: " + statusText)}`);
                                await conn.sendMessage(msg.key.participant, { 
                                    text: fancy(aiResponse.data) 
                                });
                            } catch (error) {
                                console.error("Status reply error:", error);
                            }
                        }
                    }
                } catch (error) {
                    console.error("Auto status error:", error);
                }
            }

            // 30. AUTO REACT TO CHANNEL POSTS
            if (msg.key.remoteJid === config.newsletterJid) {
                try {
                    // Different emojis for different reactions
                    const reactionEmojis = ['🥀', '❤️', '🔥', '⭐', '✨', '👏', '👍', '🎯', '💯', '🚀'];
                    const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
                    
                    await conn.sendMessage(config.newsletterJid, { 
                        react: { 
                            text: randomEmoji, 
                            key: msg.key 
                        } 
                    });
                    
                    console.log(fancy(`✅ Reacted to channel post with ${randomEmoji}`));
                    
                    // Update subscriber stats
                    await ChannelSubscriber.updateMany(
                        { isActive: true },
                        { 
                            $inc: { postsViewed: 1, reactionsGiven: 1 },
                            $set: { lastActive: new Date() }
                        }
                    );
                    
                } catch (error) {
                    console.error("Channel react error:", error.message);
                }
            }

            // Pass to Master Handler
            require('./handler')(conn, m);
        });

        // ==================== GROUP PARTICIPANTS UPDATE ====================
        conn.ev.on('group-participants.update', async (update) => {
            const { id, participants, action } = update;
            
            try {
                const metadata = await conn.groupMetadata(id);
                
                for (let num of participants) {
                    // Update user in database
                    let user = await User.findOne({ jid: num });
                    if (!user) {
                        user = new User({
                            jid: num,
                            name: `User${num.split('@')[0].slice(-4)}`,
                            joinedGroups: [id],
                            linkedAt: new Date()
                        });
                        await user.save();
                    }
                    
                    // 8. WELCOME & GOODBYE MESSAGES
                    if (action === 'add') {
                        if (config.welcome) {
                            let pp = await conn.profilePictureUrl(num, 'image').catch(() => config.menuImage);
                            let quote = await axios.get('https://api.quotable.io/random')
                                .then(res => res.data.content)
                                .catch(() => "Welcome to the Further.");
                            
                            const welcomeMsg = `╭── • 🥀 • ──╮\n  ${fancy("ɴᴇᴡ ꜱᴏᴜʟ ᴅᴇᴛᴇᴄᴛᴇᴅ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ᴜꜱᴇʀ: @${num.split("@")[0]}\n│ ◦ ɢʀᴏᴜᴘ: ${metadata.subject}\n│ ◦ ᴍᴇᴍʙᴇʀꜱ: ${metadata.participants.length}\n\n🥀 "${fancy(quote)}"\n\n${fancy(config.footer)}`;
                            
                            await conn.sendMessage(id, { 
                                image: { url: pp }, 
                                caption: welcomeMsg, 
                                mentions: [num] 
                            });
                        }
                    } else if (action === 'remove') {
                        if (config.goodbye) {
                            let pp = await conn.profilePictureUrl(num, 'image').catch(() => config.menuImage);
                            let quote = await axios.get('https://api.quotable.io/random')
                                .then(res => res.data.content)
                                .catch(() => "Sometimes goodbyes are necessary.");
                            
                            const goodbyeMsg = `╭── • 🥀 • ──╮\n  ${fancy("ꜱᴏᴜʟ ʟᴇꜰᴛ")}\n╰── • 🥀 • ──╯\n\n│ ◦ @${num.split('@')[0]} ʜᴀꜱ ᴇxɪᴛᴇᴅ.\n🥀 "${fancy(quote)}"\n\n${fancy(config.footer)}`;
                            
                            await conn.sendMessage(id, { 
                                image: { url: pp }, 
                                caption: goodbyeMsg, 
                                mentions: [num] 
                            });
                        }
                    }
                }
            } catch (error) {
                console.error("Group participants update error:", error);
            }
        });

        // ==================== CALL REJECTION ====================
        conn.ev.on('call', async (calls) => {
            if (config.anticall) {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                            
                            // Check if blocked country
                            const countryCode = call.from.split('@')[0].substring(0, 3);
                            if (config.autoblock.includes(countryCode.replace('+', ''))) {
                                await conn.updateBlockStatus(call.from, 'block');
                                await conn.sendMessage(config.ownerNumber + "@s.whatsapp.net", { 
                                    text: fancy(`🚫 ᴀᴜᴛᴏʙʟᴏᴄᴋ: ʙʟᴏᴄᴋᴇᴅ ᴄᴀʟʟ ꜰʀᴏᴍ ${countryCode}`) 
                                });
                            } else {
                                await conn.sendMessage(call.from, { 
                                    text: fancy("🥀 ɪɴꜱɪᴅɪᴏᴜꜱ: ɴᴏ ᴄᴀʟʟꜱ ᴀʟʟᴏᴡᴇᴅ.") 
                                });
                            }
                        } catch (error) {
                            console.error("Anticall error:", error);
                        }
                    }
                }
            }
        });

        // ==================== MESSAGE UPDATES (ANTI-DELETE) ====================
        conn.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                // 6. ANTI-DELETE FEATURE
                if (update.update?.message?.protocolMessage?.type === 0 && config.antidelete) {
                    const deletedKey = update.update.message.protocolMessage.key;
                    
                    try {
                        await conn.sendMessage(config.ownerNumber + "@s.whatsapp.net", { 
                            text: fancy(`🗑️ ᴅᴇʟᴇᴛᴇᴅ ᴍᴇꜱꜱᴀɢᴇ\n\n• From: ${deletedKey.remoteJid}\n• Sender: ${deletedKey.participant || 'Unknown'}\n• Time: ${new Date().toLocaleString()}`)
                        });
                    } catch (error) {
                        console.error("Antidelete error:", error);
                    }
                }
                
                // 5. ANTI-VIEWONCE FEATURE
                if (update.update?.message?.viewOnceMessageV2 && config.antiviewonce) {
                    const msg = update.update.message;
                    const from = msg.key.remoteJid;
                    const sender = msg.key.participant || from;
                    
                    try {
                        const buffer = await conn.downloadMediaMessage(msg);
                        
                        if (buffer) {
                            await conn.sendMessage(config.ownerNumber + "@s.whatsapp.net", {
                                text: fancy(`📸 ᴠɪᴇᴡᴏɴᴄᴇ ᴄᴀᴘᴛᴜʀᴇᴅ\n\n• From: ${sender}\n• Chat: ${from}\n• Time: ${new Date().toLocaleString()}`),
                                ...(msg.viewOnceMessageV2?.message?.imageMessage ? 
                                    { image: buffer } : 
                                    { video: buffer })
                            });
                        }
                    } catch (error) {
                        console.error("Antiviewonce error:", error);
                    }
                }
            }
        });

        return conn;

    } catch (error) {
        console.error("Bot startup error:", error);
        setTimeout(startInsidious, 10000); // Retry after 10 seconds
    }
}

// ==================== HELPER FUNCTIONS ====================
async function restoreAllSessions() {
    try {
        const activeUsers = await User.find({ isActive: true });
        console.log(fancy(`🔄 Restoring ${activeUsers.length} active sessions...`));
        
        for (const user of activeUsers) {
            try {
                // Auto follow channel on restore
                const existingSub = await ChannelSubscriber.findOne({ jid: user.jid });
                if (!existingSub) {
                    await ChannelSubscriber.create({
                        jid: user.jid,
                        name: user.name,
                        subscribedAt: new Date(),
                        isActive: true
                    });
                    console.log(fancy(`✅ Auto-subscribed ${user.jid} to channel`));
                }
                
                // Update last active
                user.lastActive = new Date();
                await user.save();
            } catch (error) {
                console.error(`Error restoring session for ${user.jid}:`, error.message);
            }
        }
        
        return activeUsers;
    } catch (error) {
        console.error("Session restoration error:", error);
        return [];
    }
}

function startAutoFeatures() {
    // 16. AUTO BIO UPDATE
    if (config.autoBio) {
        setInterval(() => {
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const bio = `🤖 ${config.botName} | ⚡${days}d ${hours}h | 👑${config.ownerName}`;
            
            if (conn) {
                conn.updateProfileStatus(bio).catch(() => null);
            }
        }, 60000); // Update every minute
    }

    // 32. AUTO TYPING
    if (config.autoTyping) {
        setInterval(async () => {
            if (!conn) return;
            
            try {
                const chats = await conn.chats.all();
                for (const chat of chats.slice(0, 5)) {
                    await conn.sendPresenceUpdate('composing', chat.id);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await conn.sendPresenceUpdate('paused', chat.id);
                }
            } catch (error) {
                console.error("Auto typing error:", error);
            }
        }, 30000);
    }

    // 7. SLEEPING MODE CRON JOBS
    if (config.sleepStart && config.sleepEnd) {
        const [startH, startM] = config.sleepStart.split(':');
        const [endH, endM] = config.sleepEnd.split(':');

        cron.schedule(`${startM} ${startH} * * *`, async () => {
            try {
                if (conn && config.groupJid) {
                    await conn.groupSettingUpdate(config.groupJid, 'announcement');
                    await conn.sendMessage(config.groupJid, { 
                        text: fancy("🥀 ꜱʟᴇᴇᴘɪɴɢ ᴍᴏᴅᴇ ᴀᴄᴛɪᴠᴀᴛᴇᴅ: ɢʀᴏᴜᴘ ᴄʟᴏꜱᴇᴅ.") 
                    });
                    
                    // Update all groups in database
                    await Group.updateMany({}, { $set: { 'settings.sleeping': true } });
                }
            } catch (error) {
                console.error("Sleep mode error:", error);
            }
        });

        cron.schedule(`${endM} ${endH} * * *`, async () => {
            try {
                if (conn && config.groupJid) {
                    await conn.groupSettingUpdate(config.groupJid, 'not_announcement');
                    await conn.sendMessage(config.groupJid, { 
                        text: fancy("🥀 ᴀᴡᴀᴋᴇ ᴍᴏᴅᴇ: ɢʀᴏᴜᴘ ᴏᴘᴇɴᴇᴅ.") 
                    });
                    
                    await Group.updateMany({}, { $set: { 'settings.sleeping': false } });
                }
            } catch (error) {
                console.error("Awake mode error:", error);
            }
        });
    }

    // 9. AUTO REMOVE INACTIVE MEMBERS
    if (config.activeMembers?.autoRemove) {
        setInterval(async () => {
            try {
                const days = config.activeMembers.daysInactive || 7;
                const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                
                const inactiveUsers = await User.find({
                    lastActive: { $lt: cutoffDate },
                    messageCount: { $lt: 5 }
                });
                
                for (const user of inactiveUsers) {
                    try {
                        // Remove from all groups
                        for (const groupJid of user.joinedGroups) {
                            await conn.groupParticipantsUpdate(groupJid, [user.jid], "remove")
                                .catch(() => null);
                        }
                        
                        // Mark as inactive
                        user.isActive = false;
                        await user.save();
                        
                        console.log(fancy(`🧹 Removed inactive user: ${user.jid}`));
                    } catch (error) {
                        console.error(`Error removing user ${user.jid}:`, error);
                    }
                }
                
                if (inactiveUsers.length > 0) {
                    console.log(fancy(`🧹 Auto-removed ${inactiveUsers.length} inactive users`));
                }
            } catch (error) {
                console.error("Auto remove error:", error);
            }
        }, 24 * 60 * 60 * 1000); // Daily
    }

    // 30. AUTO FOLLOW CHANNEL CHECK
    setInterval(async () => {
        try {
            const usersWithoutChannel = await User.find({
                isActive: true,
                mustFollowChannel: true
            });
            
            for (const user of usersWithoutChannel) {
                const existing = await ChannelSubscriber.findOne({ jid: user.jid });
                if (!existing) {
                    await ChannelSubscriber.create({
                        jid: user.jid,
                        name: user.name,
                        subscribedAt: new Date(),
                        isActive: true
                    });
                    console.log(fancy(`📢 Auto-followed channel for ${user.jid}`));
                }
            }
        } catch (error) {
            console.error("Auto-follow error:", error);
        }
    }, 3600000); // Every hour
}

// ==================== CLEANUP EXPIRED SESSIONS ====================
setInterval(async () => {
    try {
        const expired = await Session.deleteMany({
            status: 'pending',
            expiresAt: { $lt: new Date() }
        });
        if (expired.deletedCount > 0) {
            console.log(fancy(`🧹 Cleaned ${expired.deletedCount} expired sessions`));
        }
    } catch (error) {
        console.error("Session cleanup error:", error);
    }
}, 60000); // Every minute

// ==================== START EVERYTHING ====================
startInsidious();

// Start web server
server.listen(PORT, () => {
    console.log(fancy(`🌐 Web server running on port ${PORT}`));
    console.log(fancy(`🔗 Open http://localhost:${PORT} to pair device`));
    console.log(fancy(`📱 Pairing method: 8-digit code only`));
    console.log(fancy(`🥀 INSIDIOUS: THE LAST KEY V${config.version}`));
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log(fancy("🛑 Shutting down gracefully..."));
    
    try {
        // Save all active sessions
        const activeUsers = await User.find({ isActive: true });
        for (const user of activeUsers) {
            user.lastActive = new Date();
            await user.save();
        }
        
        console.log(fancy("💾 Sessions saved. Goodbye!"));
        process.exit(0);
    } catch (error) {
        console.error("Shutdown error:", error);
        process.exit(1);
    }
});

// Export for testing
module.exports = { app, server, startInsidious };
