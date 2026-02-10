const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");
const config = require("./config");
const { fancy } = require("./lib/font");
const path = require("path");
const { User, Group, ChannelSubscriber, Settings } = require('./database/models');

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE CONNECTION
mongoose.connect(config.mongodb || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority")
    .then(() => console.log(fancy("🥀 DB Connected: Insidious is eternal")))
    .catch(err => console.error("DB Error:", err.message));

// MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
            version: config.version || "2.1.1",
            botName: config.botName || "Insidious Bot"
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
                antilink: settings.antilink || config.antilink || true,
                antiporn: settings.antiporn || config.antiporn || true,
                antiscam: settings.antiscam || config.antiscam || true,
                antimedia: settings.antimedia || config.antimedia || false,
                antitag: settings.antitag || config.antitag || true,
                antiviewonce: settings.antiviewonce || config.antiviewonce || false,
                antidelete: settings.antidelete || config.antidelete || true,
                sleepingMode: settings.sleepingMode || config.sleepingMode || false,
                welcomeGoodbye: settings.welcomeGoodbye || config.welcomeGoodbye || true,
                activeMembers: settings.activeMembers || config.activeMembers || true,
                autoblockCountry: settings.autoblockCountry || config.autoblockCountry || false,
                chatbot: settings.chatbot || config.chatbot || true,
                autoStatus: settings.autoStatus || config.autoStatus || false,
                autoRead: settings.autoRead || config.autoRead || true,
                autoReact: settings.autoReact || config.autoReact || false,
                autoSave: settings.autoSave || config.autoSave || false,
                autoBio: settings.autoBio || config.autoBio || true,
                anticall: settings.anticall || config.anticall || true,
                downloadStatus: settings.downloadStatus || config.downloadStatus || true,
                antispam: settings.antispam || config.antispam || true,
                antibug: settings.antibug || config.antibug || true
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
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName || 'insidious-session');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: true,
        getMessage: async (key) => ({ conversation: "message deleted" })
    });

    globalConn = conn;

    // CONNECTION HANDLER
    conn.ev.on('connection.update', async (u) => {
        const { connection, qr } = u;
        
        if (connection === 'open') {
            console.log(fancy("👹 INSIDIOUS ACTIVE"));
            
            // Send message to owner
            if (config.sendWelcomeToOwner !== false) {
                const ownerJid = (config.ownerNumber || "255000000000") + '@s.whatsapp.net';
                const welcomeMsg = `╭─── • 🥀 • ───╮\n   ${fancy("ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1")}\n╰─── • 🥀 • ───╯\n\n✅ Bot Activated Successfully!\n📊 Dashboard: http://localhost:${PORT}\n\n${fancy(config.footer || "© Insidious Bot - Eternal Darkness")}`;
                await conn.sendMessage(ownerJid, { text: welcomeMsg }).catch(() => {});
            }
            
            // Initialize settings if not exist
            try {
                let settings = await Settings.findOne();
                if (!settings) {
                    settings = new Settings();
                    await settings.save();
                }
            } catch (e) {}
        }
        
        // Handle reconnection
        if (connection === 'close') {
            const shouldReconnect = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(fancy("🔄 Reconnecting..."));
                setTimeout(start, 5000);
            }
        }
    });

    // PAIRING ENDPOINT
    app.get('/pair', async (req, res) => {
        let num = req.query.num;
        if (!num) return res.json({ error: "Provide a number!" });
        
        try {
            const cleanNum = num.replace(/[^0-9]/g, '');
            const code = await conn.requestPairingCode(cleanNum);
            
            // Save user to database
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

    // WELCOME & GOODBYE WITH IMPROVEMENTS
    conn.ev.on('group-participants.update', async (anu) => {
        try {
            const settings = await Settings.findOne();
            if (!settings?.welcomeGoodbye && !config.welcomeGoodbye) return;
            
            let metadata = await conn.groupMetadata(anu.id);
            let participants = anu.participants;
            
            // Get group description
            const groupDesc = metadata.desc || "No description available";
            
            // Get group picture
            let groupPicture = null;
            try {
                groupPicture = await conn.profilePictureUrl(anu.id, 'image').catch(async () => {
                    return await conn.profilePictureUrl(anu.id, 'preview').catch(() => null);
                });
            } catch (e) {
                console.log("No group picture found");
            }

            for (let num of participants) {
                let quote = "Stay in the shadows.";
                try {
                    const quoteRes = await axios.get('https://api.quotable.io/random', { timeout: 3000 });
                    quote = quoteRes.data.content;
                } catch (e) {}
                
                if (anu.action == 'add') {
                    let msg = `╭─── • 🥀 • ───╮\n   ${fancy("𝙒𝙀𝙇𝘾𝙊𝙈𝙀 𝙎𝙊𝙐𝙇")}\n╰─── • 🥀 • ───╯\n\n🎉 Welcome @${num.split("@")[0]}!\n\n📛 *Group:* ${metadata.subject}\n👥 *Members:* ${metadata.participants.length}\n📝 *Description:* ${groupDesc}\n\n🥀 "${fancy(quote)}"\n\n${fancy(config.footer || "© Insidious Bot")}`;
                    
                    // Send with group image if available
                    if (groupPicture) {
                        try {
                            const imageResponse = await axios.get(groupPicture, { responseType: 'arraybuffer' });
                            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                            
                            await conn.sendMessage(anu.id, { 
                                image: imageBuffer,
                                caption: msg,
                                mentions: [num] 
                            });
                        } catch (e) {
                            await conn.sendMessage(anu.id, { 
                                text: msg,
                                mentions: [num] 
                            });
                        }
                    } else {
                        await conn.sendMessage(anu.id, { 
                            text: msg,
                            mentions: [num] 
                        });
                    }
                    
                } else if (anu.action == 'remove') {
                    let msg = `╭─── • 🥀 • ───╮\n   ${fancy("𝙂𝙊𝙊𝘿𝘽𝙔𝙀")}\n╰─── • 🥀 • ───╯\n\n👋 @${num.split('@')[0]} has left the group\n\n📛 *Group:* ${metadata.subject}\n📝 *Description:* ${groupDesc}\n\n🥀 "${fancy(quote)}"`;
                    
                    if (groupPicture) {
                        try {
                            const imageResponse = await axios.get(groupPicture, { responseType: 'arraybuffer' });
                            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                            
                            await conn.sendMessage(anu.id, { 
                                image: imageBuffer,
                                caption: msg,
                                mentions: [num] 
                            });
                        } catch (e) {
                            await conn.sendMessage(anu.id, { 
                                text: msg,
                                mentions: [num] 
                            });
                        }
                    } else {
                        await conn.sendMessage(anu.id, { 
                            text: msg,
                            mentions: [num] 
                        });
                    }
                }
            }
        } catch (e) { 
            console.error("Group event error:", e);
        }
    });

    // ANTICALL FEATURE
    conn.ev.on('call', async (calls) => {
        try {
            const settings = await Settings.findOne();
            if (!settings?.anticall && !config.anticall) return;
            
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

    // MESSAGE HANDLER
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        // AUTO STATUS VIEWING
        if (msg.key.remoteJid === 'status@broadcast') {
            try {
                const settings = await Settings.findOne();
                if (settings?.autoStatus || config.autoStatus) {
                    await conn.readMessages([msg.key]);
                    
                    if (settings?.autoReact || config.autoReact) {
                        await conn.sendMessage('status@broadcast', 
                            { react: { text: '🥀', key: msg.key } }, 
                            { statusJidList: [msg.key.participant] }
                        );
                    }
                    
                    if (settings?.downloadStatus || config.downloadStatus) {
                        // Status download logic here
                    }
                }
            } catch (e) {}
        }

        // Pass to main handler
        require('./handler')(conn, m);
    });

    // SLEEPING MODE WITH CRON
    if (config.sleepStart && config.sleepEnd) {
        const [startH, startM] = config.sleepStart.split(':');
        const [endH, endM] = config.sleepEnd.split(':');

        cron.schedule(`${startM} ${startH} * * *`, async () => {
            try {
                const settings = await Settings.findOne();
                if (!settings?.sleepingMode && !config.sleepingMode) return;
                
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
                if (!settings?.sleepingMode && !config.sleepingMode) return;
                
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

    // AUTO BIO UPDATER
    if (config.autoBio) {
        setInterval(async () => {
            try {
                const settings = await Settings.findOne();
                if (!settings?.autoBio && !config.autoBio) return;
                
                const uptime = process.uptime();
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor((uptime % 86400) / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                
                const bio = `🤖 ${config.botName || "Insidious"} | ⚡${days}d ${hours}h ${minutes}m | 👑${config.ownerName || "Owner"}`;
                await conn.updateProfileStatus(bio);
            } catch (error) {
                console.error("Auto bio error:", error);
            }
        }, 60000); // Update every minute
    }

    // ADDITIONAL FEATURES API ENDPOINT
    app.get('/api/conn-status', (req, res) => {
        if (conn.user) {
            res.json({ 
                status: 'connected', 
                user: conn.user.id,
                name: conn.user.name 
            });
        } else {
            res.json({ status: 'disconnected' });
        }
    });

    return conn;
}

// START BOT
start();

// START SERVER
app.listen(PORT, () => console.log(fancy(`🌐 Dashboard running on port ${PORT}`)));

module.exports = { start, globalConn };
