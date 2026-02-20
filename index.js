const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const { Session, Settings, User, Group } = require('./database/models');

// ==================== HANDLER ====================
const handler = require('./handler');

// ✅ **FANCY FUNCTION**
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    const map = {
        a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
        j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
        s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
        A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
        J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
        S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
    };
    let result = '';
    for (let i = 0; i < text.length; i++) result += map[text[i]] || text[i];
    return result;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    connectTimeoutMS: 30000
})
.then(() => console.log(fancy("✅ MongoDB Connected Successfully")))
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED: " + err.message));
    process.exit(1);
});

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// ✅ **GLOBAL VARIABLES**
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();
let currentBotNumber = null;

// ✅ **LOAD CONFIG**
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("❌ Config file error, using defaults"));
    config = {
        prefix: '.',
        ownerNumber: ['255000000000'],
        botName: 'INSIDIOUS',
        workMode: 'public',
        botImage: 'https://files.catbox.moe/f3c07u.jpg'
    };
}

// ✅ **SESSION HELPERS**
async function saveSessionToMongoDB(number, creds, keys = {}) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.findOneAndUpdate(
            { sessionId: sanitizedNumber },
            { $set: { creds, keys, number: sanitizedNumber, lastActive: new Date(), isActive: true } },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error("Error saving session:", error.message);
        return false;
    }
}

async function loadSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({ sessionId: sanitizedNumber });
        if (session && session.creds) return { creds: session.creds, keys: session.keys || {} };
        return null;
    } catch (error) {
        console.error("Error loading session:", error.message);
        return null;
    }
}

async function deleteSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.deleteOne({ sessionId: sanitizedNumber });
        return true;
    } catch (error) {
        console.error("Error deleting session:", error.message);
        return false;
    }
}

// ✅ **MAIN BOT FUNCTION (SINGLE BOT, NO AUTO-RECONNECT)**
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS..."));
        const botNumber = 'insidious_main';
        const existingSession = await loadSessionFromMongoDB(botNumber);
        
        const sessionPath = path.join(__dirname, 'insidious_session');
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
        
        if (existingSession) {
            console.log(fancy("📦 Loading main session from MongoDB..."));
            fs.writeFileSync(
                path.join(sessionPath, 'creds.json'),
                JSON.stringify(existingSession.creds, null, 2)
            );
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true
        });

        globalConn = conn;
        botStartTime = Date.now();

        if (conn.user && conn.user.id) {
            currentBotNumber = conn.user.id.split(':')[0];
        }

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
                console.log(fancy("✅ Main bot is now online"));
                isConnected = true;

                const botName = conn.user?.name || "INSIDIOUS";
                const botNumber = conn.user?.id?.split(':')[0] || "Unknown";
                const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
                const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;

                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                console.log(fancy(`🆔 Bot ID: ${botSecret}`));
                console.log(fancy(`👥 Owners: ${pairedCount}`));

                try {
                    if (handler && typeof handler.init === 'function') {
                        await handler.init(conn);
                    }
                } catch (e) {
                    console.error("Handler init error:", e.message);
                }

                if (conn.authState?.creds) {
                    await saveSessionToMongoDB(botNumber, conn.authState.creds, {});
                }

                // Send welcome message to owner
                setTimeout(async () => {
                    try {
                        if (config.ownerNumber && config.ownerNumber.length > 0) {
                            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
                            if (ownerNum.length >= 10) {
                                const ownerJid = ownerNum + '@s.whatsapp.net';
                                const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🆔 *Bot ID:* ${botSecret}
👥 *Owners:* ${pairedCount}

⚡ *Status:* ONLINE
📦 *Storage:* MongoDB
👑 *Developer:* STANYTZ (Stanley Assanaly, 23 yrs)
💾 *Version:* 2.1.1`;
                                
                                await conn.sendMessage(ownerJid, { 
                                    image: { url: config.botImage || "https://files.catbox.moe/f3c07u.jpg" },
                                    caption: welcomeMsg,
                                    contextInfo: { isForwarded: true }
                                });
                            }
                        }
                    } catch (e) {}
                }, 3000);
            }
            
            if (connection === 'close') {
                console.log(fancy("🔌 Main bot connection closed"));
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(fancy("🚫 Logged out. Removing session from MongoDB."));
                    await deleteSessionFromMongoDB('insidious_main');
                }
                // NO AUTO-RECONNECT – PLATFORM ITARE
            }
        });

        conn.ev.on('creds.update', async () => {
            if (conn.authState?.creds) {
                await saveCreds();
                await saveSessionToMongoDB('insidious_main', conn.authState.creds, {});
            }
        });

        conn.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (msg && msg.key && msg.key.remoteJid && !msg.key.remoteJid.includes('@g.us')) {
                    await User.findOneAndUpdate(
                        { jid: msg.key.remoteJid },
                        { $set: { lastActive: new Date() }, $inc: { messageCount: 1 } },
                        { upsert: true }
                    );
                }
                if (handler && typeof handler === 'function') await handler(conn, m);
            } catch (error) {
                console.error("Message handler error:", error.message);
            }
        });

        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (update.id) {
                    const groupMetadata = await conn.groupMetadata(update.id).catch(() => null);
                    if (groupMetadata) {
                        const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                        await Group.findOneAndUpdate(
                            { jid: update.id },
                            {
                                $set: {
                                    name: groupMetadata.subject,
                                    participants: groupMetadata.participants.length,
                                    admins: admins
                                }
                            },
                            { upsert: true }
                        );
                    }
                }
                if (handler && handler.handleGroupUpdate) await handler.handleGroupUpdate(conn, update);
            } catch (error) {
                console.error("Group update error:", error.message);
            }
        });

        conn.ev.on('call', async (call) => {
            try {
                if (handler && handler.handleCall) await handler.handleCall(conn, call);
            } catch (error) {
                console.error("Call handler error:", error.message);
            }
        });

        console.log(fancy("🚀 Main bot ready"));
        
    } catch (error) {
        console.error("Start error:", error.message);
        // Hakuna auto-restart – platform itashughulikia
    }
}

// ✅ **ANZA MAIN BOT**
startBot();

// ==================== HTTP ENDPOINTS ====================

// ✅ **PAIRING ENDPOINT**
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ success: false, error: "Provide number!" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) return res.json({ success: false, error: "Invalid number." });
        if (!globalConn) return res.json({ success: false, error: "Bot not ready." });
        
        const code = await Promise.race([
            globalConn.requestPairingCode(cleanNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
        ]);
        res.json({ success: true, code, message: `8-digit code: ${code}` });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ✅ **UNPAIR ENDPOINT**
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ success: false, error: "Provide number!" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) return res.json({ success: false, error: "Invalid number." });
        
        let result = false;
        if (handler && handler.unpairNumber) {
            result = await handler.unpairNumber(cleanNum);
        }
        
        if (result) {
            await deleteSessionFromMongoDB(cleanNum);
        }
        
        res.json({ success: result, message: result ? `Unpaired ${cleanNum}` : `Failed to unpair` });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ✅ **HEALTH CHECK**
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        connected: isConnected,
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ✅ **BOT INFO**
app.get('/botinfo', (req, res) => {
    if (!globalConn || !globalConn.user) {
        return res.json({ connected: false });
    }
    res.json({
        connected: true,
        botName: globalConn.user?.name,
        botNumber: globalConn.user?.id?.split(':')[0]
    });
});

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Server running on port ${PORT}`));
    console.log(fancy(`👑 Developer: STANYTZ (Stanley Assanaly, 23 yrs)`));
});

module.exports = app;