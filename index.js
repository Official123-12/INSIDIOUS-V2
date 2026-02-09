const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    getAggregateVotesInPollMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");
const cron = require("node-cron");
const { fancy } = require("./lib/font");
const config = require("./config");
const app = express();
const PORT = process.env.PORT || 3000;

// IMPORT DATABASE MODELS
const { User, Group, ChannelSubscriber } = require('./database/models');

/**
 * INSIDIOUS: THE LAST KEY V2.1.1
 * COMPLETE ENTRY POINT WITH ALL FEATURES
 */

// DATABASE CONNECTION
mongoose.connect(config.mongodb, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log(fancy("🥀 database connected: insidious is eternal.")))
    .catch(err => console.error("DB Connection Error:", err));

// WEB PAIRING DASHBOARD
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ADD THESE ROUTES FOR WEB MANAGEMENT
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

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
            version: config.version
        });
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
        // REMOVED: printQRInTerminal: true, - USING CUSTOM HANDLER
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: true,
        getMessage: async (key) => {
            return {
                conversation: "message deleted"
            }
        }
    });

    globalConn = conn;

    // FIXED: HANDLE QR CODE MANUALLY
    conn.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        // QR CODE HANDLING
        if (qr) {
            qrCodeData = qr;
            console.log(fancy("📱 Scan QR Code below:"));
            // Simple QR in terminal (alternative)
            console.log(`QR Code: ${qr.substring(0, 50)}...`);
            
            // You can also use qrcode-terminal package if installed
            try {
                const qrcode = require('qrcode-terminal');
                qrcode.generate(qr, { small: true });
            } catch (e) {
                console.log("Install qrcode-terminal for better QR display");
            }
        }
        
        if (connection === 'open') {
            console.log(fancy("👹 insidious is alive and connected."));
            qrCodeData = null; // Clear QR after connection
            
            // Auto subscribe owner to channel
            try {
                const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                const existing = await ChannelSubscriber.findOne({ jid: ownerJid });
                if (!existing) {
                    await ChannelSubscriber.create({
                        jid: ownerJid,
                        name: config.ownerName,
                        subscribedAt: new Date(),
                        isActive: true
                    });
                }
                
                // Send welcome to owner
                const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ Bot is online!\n📊 Dashboard: http://localhost:${PORT}\n\n${fancy(config.footer)}`;
                await conn.sendMessage(ownerJid, { text: welcomeMsg });
                
            } catch (error) {
                console.error("Channel subscription error:", error);
            }
        }
        
        // AUTO RECONNECT
        if (connection === 'close') {
            const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(fancy("🔄 Reconnecting..."));
                setTimeout(startInsidious, 5000);
            }
        }
    });

    // QR CODE ENDPOINT FOR WEB
    app.get('/api/qr', (req, res) => {
        if (qrCodeData) {
            res.json({ qr: qrCodeData });
        } else {
            res.json({ status: 'connected', qr: null });
        }
    });

    // FIXED: PAIRING CODE ENDPOINT - ALLOW MULTIPLE PAIRS
    app.get('/pair', async (req, res) => {
        let num = req.query.num;
        if (!num) return res.json({ error: "Provide a number!" });
        
        try {
            // REMOVED: Check if user already exists - ALLOW MULTIPLE PAIRS
            const cleanNum = num.replace(/[^0-9]/g, '');
            
            // Generate pairing code
            const code = await conn.requestPairingCode(cleanNum);
            
            // Save/Update user in database
            await User.findOneAndUpdate(
                { jid: cleanNum + '@s.whatsapp.net' },
                {
                    jid: cleanNum + '@s.whatsapp.net',
                    deviceId: Math.random().toString(36).substr(2, 8),
                    linkedAt: new Date(),
                    isActive: true,
                    mustFollowChannel: true,
                    pairCount: { $inc: 1 }
                },
                { upsert: true, new: true }
            );
            
            res.json({ 
                success: true, 
                code: code,
                message: "Scan code in WhatsApp Linked Devices",
                note: "Multiple pairings allowed"
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

    // 12. AUTO STATUS FEATURE
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        // Auto Status logic
        if (msg.key.remoteJid === 'status@broadcast' && config.autoStatus.view) {
            try {
                // Auto view
                await conn.readMessages([msg.key]);
                
                // Auto like with different emojis
                if (config.autoStatus.like) {
                    const emojis = ['🥀', '❤️', '🔥', '⭐', '✨', '👏'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    
                    await conn.sendMessage('status@broadcast', { 
                        react: { 
                            text: randomEmoji, 
                            key: msg.key 
                        } 
                    });
                }
                
                // Auto reply to status
                if (config.autoStatus.reply && msg.key.participant) {
                    const statusText = msg.message.conversation || 
                                     msg.message.extendedTextMessage?.text || 
                                     msg.message.imageMessage?.caption || '';
                    if (statusText) {
                        try {
                            const aiResponse = await axios.get(`${config.aiModel}${encodeURIComponent("Reply to this status: " + statusText)}`);
                            await conn.sendMessage(msg.key.participant, { 
                                text: fancy(aiResponse.data) 
                            });
                        } catch (aiErr) {
                            console.error("AI reply error:", aiErr);
                        }
                    }
                }
            } catch (error) {
                console.error("Auto status error:", error);
            }
        }

        // Pass to Master Handler
        require('./handler')(conn, m);
    });

    // 8. WELCOME & GOODBYE WITH CHANNEL ENFORCEMENT
    conn.ev.on('group-participants.update', async (anu) => {
        try {
            const metadata = await conn.groupMetadata(anu.id);
            const participants = anu.participants;
            
            for (let num of participants) {
                // 30. CHECK CHANNEL SUBSCRIPTION
                const isSubscribed = await ChannelSubscriber.findOne({ jid: num, isActive: true });
                const user = await User.findOne({ jid: num });
                
                let pp;
                try {
                    pp = await conn.profilePictureUrl(num, 'image');
                } catch {
                    pp = config.menuImage;
                }
                
                let quote = await axios.get('https://api.quotable.io/random')
                    .then(res => res.data.content)
                    .catch(() => "Welcome to the Further.");

                if (anu.action == 'add') {
                    // Force channel subscription message
                    let welcome = `╭── • 🥀 • ──╮\n  ${fancy("ɴᴇᴡ ꜱᴏᴜʟ ᴅᴇᴛᴇᴄᴛᴇᴅ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ᴜꜱᴇʀ: @${num.split("@")[0]}\n│ ◦ ɢʀᴏᴜᴘ: ${metadata.subject}\n│ ◦ ᴍᴇᴍʙᴇʀꜱ: ${metadata.participants.length}\n\n${!isSubscribed ? '⚠️ *MUST FOLLOW CHANNEL FIRST*\n' + config.channelLink + '\n\n' : ''}🥀 "${fancy(quote)}"\n\n${fancy(config.footer)}`;
                    
                    await conn.sendMessage(anu.id, { 
                        image: { url: pp }, 
                        caption: welcome, 
                        mentions: [num] 
                    });
                    
                    // Save user to database if not exists
                    if (!user) {
                        await User.create({
                            jid: num,
                            name: `User${num.split('@')[0].slice(-4)}`,
                            joinedGroups: [anu.id],
                            joinedAt: new Date(),
                            mustFollowChannel: !isSubscribed
                        });
                    }
                    
                } else if (anu.action == 'remove') {
                    let goodbye = `╭── • 🥀 • ──╮\n  ${fancy("ꜱᴏᴜʟ ʟᴇꜰᴛ")}\n╰── • 🥀 • ──╯\n\n│ ◦ @${num.split('@')[0]} ʜᴀꜱ ᴇxɪᴛᴇᴅ.\n🥀 "${fancy(quote)}"`;
                    await conn.sendMessage(anu.id, { 
                        image: { url: pp }, 
                        caption: goodbye, 
                        mentions: [num] 
                    });
                }
            }
        } catch (e) { 
            console.error("Group event error:", e);
        }
    });

    // 17. ANTICALL COMPLETE
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
                                text: fancy("🥀 ɪɴꜱɪᴅɪᴏᴜꜱ: ɴᴏ ᴄᴀʟʟꜱ ᴀʟʟᴏᴡᴇᴅ. ʏᴏᴜ ʜᴀᴠᴇ ʙᴇᴇɴ ʀᴇᴘᴏʀᴛᴇᴅ.") 
                            });
                        }
                    } catch (error) {
                        console.error("Anticall error:", error);
                    }
                }
            }
        }
    });

    // 7. SLEEPING MODE ENHANCED
    if (config.sleepStart && config.sleepEnd) {
        const [startH, startM] = config.sleepStart.split(':');
        const [endH, endM] = config.sleepEnd.split(':');

        cron.schedule(`${startM} ${startH} * * *`, async () => {
            try {
                await conn.groupSettingUpdate(config.groupJid, 'announcement');
                await conn.sendMessage(config.groupJid, { 
                    text: fancy("🥀 ꜱʟᴇᴇᴘɪɴɢ ᴍᴏᴅᴇ ᴀᴄᴛɪᴠᴀᴛᴇᴅ: ɢʀᴏᴜᴘ ᴄʟᴏꜱᴇᴅ.\n⏰ Will reopen at " + config.sleepEnd) 
                });
                
                // Update all groups in database
                await Group.updateMany({}, { $set: { sleeping: true } });
            } catch (error) {
                console.error("Sleep mode error:", error);
            }
        });

        cron.schedule(`${endM} ${endH} * * *`, async () => {
            try {
                await conn.groupSettingUpdate(config.groupJid, 'not_announcement');
                await conn.sendMessage(config.groupJid, { 
                    text: fancy("🥀 ᴀᴡᴀᴋᴇ ᴍᴏᴅᴇ: ɢʀᴏᴜᴘ ᴏᴘᴇɴᴇᴅ.") 
                });
                
                await Group.updateMany({}, { $set: { sleeping: false } });
            } catch (error) {
                console.error("Awake mode error:", error);
            }
        });
    }

    // 16. AUTO BIO WITH UPTIME
    if (config.autoBio) {
        setInterval(async () => {
            try {
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

    // FIXED: 32. AUTO TYPING FOR ALL CHATS - FIXED UNDEFINED ERROR
    if (config.autoTyping) {
        setInterval(async () => {
            try {
                // FIXED: Handle chats properly
                if (conn.chats) {
                    const chatArray = Object.values(conn.chats);
                    for (const chat of chatArray.slice(0, 5)) {
                        try {
                            await conn.sendPresenceUpdate('composing', chat.id);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            await conn.sendPresenceUpdate('paused', chat.id);
                        } catch (presenceError) {
                            continue;
                        }
                    }
                }
            } catch (error) {
                console.error("Auto typing interval error:", error);
            }
        }, 30000);
    }

    // 30. AUTO REACT TO CHANNEL POSTS
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        // Check if message is from our channel
        if (msg.key.remoteJid === config.newsletterJid) {
            try {
                // Auto react with different emojis
                const emojis = ['🥀', '❤️', '🔥', '⭐', '✨', '👏', '👍', '🎯'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                
                await conn.sendMessage(config.newsletterJid, { 
                    react: { 
                        text: randomEmoji, 
                        key: msg.key 
                    } 
                });
                
                console.log(fancy(`Reacted to channel post with ${randomEmoji}`));
            } catch (error) {
                console.error("Channel react error:", error);
            }
        }
    });

    return conn;
}

// Start the bot
startInsidious().catch(console.error);

// Start web server
app.listen(PORT, () => console.log(`🌐 Dashboard running on port ${PORT}`));

module.exports = { startInsidious, globalConn };
