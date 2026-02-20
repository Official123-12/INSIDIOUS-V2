const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const { Session, Settings, User, Group } = require('./models');

// ==================== HANDLER ====================
const handler = require('./handler');

// ✅ **ACTIVE SOCKETS TRACKING**
const activeSockets = new Map();
const socketCreationTime = new Map();

// ✅ **FANCY FUNCTION**
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    
    try {
        const fancyMap = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
        };
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            result += fancyMap[char] || char;
        }
        return result;
    } catch (e) {
        return text;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION (LAZIMA IWE IMEUNGANISHWA)**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    connectTimeoutMS: 30000
})
.then(() => {
    console.log(fancy("✅ MongoDB Connected Successfully"));
    console.log(fancy("📦 Database: insidious"));
})
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
    console.log(fancy("🛑 Bot cannot start without MongoDB"));
    process.exit(1); // Exit if MongoDB fails
});

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ✅ **GLOBAL VARIABLES**
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

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

// ✅ **SAVE SESSION TO MONGODB**
async function saveSessionToMongoDB(number, creds, keys = {}) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        
        await Session.findOneAndUpdate(
            { sessionId: sanitizedNumber },
            {
                $set: {
                    sessionData: { creds, keys },
                    creds: creds,
                    keys: keys,
                    number: sanitizedNumber,
                    lastActive: new Date(),
                    isActive: true,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );
        
        console.log(fancy(`✅ Session saved to MongoDB for ${sanitizedNumber}`));
        return true;
    } catch (error) {
        console.error(fancy("❌ Error saving session to MongoDB:"), error.message);
        return false;
    }
}

// ✅ **LOAD SESSION FROM MONGODB**
async function loadSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        
        const session = await Session.findOne({ sessionId: sanitizedNumber });
        
        if (session && session.creds) {
            console.log(fancy(`✅ Session loaded from MongoDB for ${sanitizedNumber}`));
            return {
                creds: session.creds,
                keys: session.keys || {}
            };
        }
        
        console.log(fancy(`📭 No session found in MongoDB for ${sanitizedNumber}`));
        return null;
    } catch (error) {
        console.error(fancy("❌ Error loading session from MongoDB:"), error.message);
        return null;
    }
}

// ✅ **DELETE SESSION FROM MONGODB**
async function deleteSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        
        await Session.deleteOne({ sessionId: sanitizedNumber });
        
        console.log(fancy(`🗑️ Session deleted from MongoDB for ${sanitizedNumber}`));
        return true;
    } catch (error) {
        console.error(fancy("❌ Error deleting session from MongoDB:"), error.message);
        return false;
    }
}

// ✅ **UPDATE SESSION ACTIVITY**
async function updateSessionActivity(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        
        await Session.findOneAndUpdate(
            { sessionId: sanitizedNumber },
            {
                $set: {
                    lastActive: new Date(),
                    isActive: true
                }
            }
        );
    } catch (error) {
        console.error("Error updating session activity:", error.message);
    }
}

// ✅ **SAVE USER TO MONGODB**
async function saveUserToMongoDB(jid, name) {
    try {
        await User.findOneAndUpdate(
            { jid: jid },
            {
                $set: {
                    name: name || 'Unknown',
                    lastActive: new Date()
                },
                $inc: { messageCount: 1 }
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error("Error saving user:", error.message);
    }
}

// ✅ **SAVE GROUP TO MONGODB**
async function saveGroupToMongoDB(jid, name, participants, admins) {
    try {
        await Group.findOneAndUpdate(
            { jid: jid },
            {
                $set: {
                    name: name || 'Unknown Group',
                    participants: participants || 0,
                    admins: admins || [],
                    joinedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error("Error saving group:", error.message);
    }
}

// ✅ **MAIN BOT FUNCTION**
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS..."));
        
        const botNumber = 'insidious_main';
        
        // ✅ **LOAD SESSION FROM MONGODB**
        const existingSession = await loadSessionFromMongoDB(botNumber);
        
        // ✅ **CREATE TEMP AUTH FOLDER**
        const sessionPath = path.join(__dirname, 'insidious_session');
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        
        // ✅ **IF SESSION EXISTS IN MONGODB, SAVE TO FILE FOR BAILEYS**
        if (existingSession) {
            console.log(fancy("📦 Loading session from MongoDB..."));
            fs.writeFileSync(
                path.join(sessionPath, 'creds.json'),
                JSON.stringify(existingSession.creds, null, 2)
            );
        }
        
        // ✅ **AUTHENTICATION**
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        // ✅ **CREATE CONNECTION**
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
        socketCreationTime.set(botNumber, Date.now());
        activeSockets.set(botNumber, conn);

        // ✅ **CONNECTION EVENT HANDLER**
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                
                isConnected = true;
                
                // Get bot info
                let botName = conn.user?.name || "INSIDIOUS";
                let botNumber = "Unknown";
                let botId = conn.user?.id || "Unknown";
                
                if (conn.user?.id) {
                    botNumber = conn.user.id.split(':')[0] || "Unknown";
                }
                
                // 🔥 GET BOT ID AND PAIRED COUNT FROM HANDLER
                const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
                const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
                
                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                console.log(fancy(`🆔 Bot ID: ${botSecret}`));
                console.log(fancy(`👥 Paired Owners: ${pairedCount}`));
                
                // ✅ **INITIALIZE HANDLER**
                try {
                    if (handler && typeof handler.init === 'function') {
                        await handler.init(conn);
                        console.log(fancy("✅ Handler initialized"));
                    }
                } catch (e) {
                    console.error(fancy("❌ Handler init error:"), e.message);
                }
                
                // ✅ **SAVE SESSION TO MONGODB**
                if (conn.authState && conn.authState.creds) {
                    await saveSessionToMongoDB(botNumber, conn.authState.creds, {});
                }
                
                // ✅ **UPDATE SESSION ACTIVITY**
                await updateSessionActivity(botNumber);
                
                // ✅ **SEND WELCOME MESSAGE TO OWNER**
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
👥 *Paired Owners:* ${pairedCount}
📦 *Storage:* MongoDB Only

⚡ *Status:* ONLINE & ACTIVE

📊 *ALL FEATURES ACTIVE:*
🛡️ Anti View Once: ✅
🗑️ Anti Delete: ✅
🤖 AI Chatbot: ✅
⚡ Auto Typing: ✅
📼 Auto Recording: ✅
👀 Auto Read: ✅
❤️ Auto React: ✅
🎉 Welcome/Goodbye: ✅

🔧 *Commands:* All working
📁 *Database:* MongoDB Connected
🚀 *Performance:* Optimal

👑 *Developer:* STANYTZ
💾 *Version:* 2.1.1 | Year: 2025`;
                                
                                await conn.sendMessage(ownerJid, { 
                                    image: { 
                                        url: config.botImage || "https://files.catbox.moe/f3c07u.jpg"
                                    },
                                    caption: welcomeMsg,
                                    contextInfo: { 
                                        isForwarded: true,
                                        forwardingScore: 999,
                                        forwardedNewsletterMessageInfo: { 
                                            newsletterJid: config.newsletterJid || "120363404317544295@newsletter",
                                            newsletterName: config.botName || "INSIDIOUS BOT"
                                        }
                                    }
                                });
                                console.log(fancy("✅ Welcome message sent to owner"));
                            }
                        }
                    } catch (e) {
                        console.log(fancy("⚠️ Could not send welcome message:"), e.message);
                    }
                }, 3000);
            }
            
            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                isConnected = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(fancy("🔄 Restarting bot in 5 seconds..."));
                    activeSockets.delete(botNumber);
                    socketCreationTime.delete(botNumber);
                    setTimeout(() => {
                        startBot();
                    }, 5000);
                } else {
                    console.log(fancy("🚫 Logged out. Please scan QR again."));
                    // Delete session from MongoDB on logout
                    await deleteSessionFromMongoDB(botNumber);
                    activeSockets.delete(botNumber);
                    socketCreationTime.delete(botNumber);
                }
            }
        });

        // ✅ **CREDENTIALS UPDATE**
        conn.ev.on('creds.update', async () => {
            if (conn.authState && conn.authState.creds) {
                await saveCreds();
                // Save to MongoDB
                await saveSessionToMongoDB(botNumber, conn.authState.creds, {});
                console.log(fancy("✅ Credentials updated and saved to MongoDB"));
            }
        });

        // ✅ **MESSAGE HANDLER WITH USER SAVING**
        conn.ev.on('messages.upsert', async (m) => {
            try {
                // Update session activity
                await updateSessionActivity(botNumber);
                
                // Save user to MongoDB
                const msg = m.messages[0];
                if (msg && msg.key && msg.key.remoteJid && !msg.key.remoteJid.includes('@g.us')) {
                    const jid = msg.key.remoteJid;
                    const name = msg.pushName || 'Unknown';
                    await saveUserToMongoDB(jid, name);
                }
                
                if (handler && typeof handler === 'function') {
                    await handler(conn, m);
                }
            } catch (error) {
                console.error("Message handler error:", error.message);
            }
        });

        // ✅ **GROUP UPDATE HANDLER**
        conn.ev.on('group-participants.update', async (update) => {
            try {
                // Save group info to MongoDB
                if (update.id) {
                    const groupMetadata = await conn.groupMetadata(update.id).catch(() => null);
                    if (groupMetadata) {
                        const admins = groupMetadata.participants
                            .filter(p => p.admin)
                            .map(p => p.id);
                        await saveGroupToMongoDB(
                            update.id, 
                            groupMetadata.subject, 
                            groupMetadata.participants.length, 
                            admins
                        );
                    }
                }
                
                if (handler && handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update);
                }
            } catch (error) {
                console.error("Group update error:", error.message);
            }
        });

        // ✅ **CALL HANDLER**
        conn.ev.on('call', async (call) => {
            try {
                if (handler && handler.handleCall) {
                    await handler.handleCall(conn, call);
                }
            } catch (error) {
                console.error("Call handler error:", error.message);
            }
        });

        console.log(fancy("🚀 Bot ready for pairing via web interface"));
        
    } catch (error) {
        console.error("Start error:", error.message);
        // Restart once on error
        setTimeout(() => {
            startBot();
        }, 10000);
    }
}

// ✅ **AUTO RECONNECT FROM MONGODB - KAMA ILIVYO KWENYE CODE YAKO**
async function autoReconnectFromMongoDB() {
    try {
        console.log(fancy("🔄 Checking for sessions in MongoDB to reconnect..."));
        
        // Get all active sessions from MongoDB
        const sessions = await Session.find({ 
            isActive: true 
        }).sort({ lastActive: -1 });

        if (sessions.length === 0) {
            console.log(fancy("📭 No active sessions found in MongoDB"));
            return;
        }

        console.log(fancy(`📦 Found ${sessions.length} session(s) in MongoDB`));

        for (const session of sessions) {
            const number = session.sessionId;
            
            // Skip if already connected
            if (activeSockets.has(number)) {
                console.log(fancy(`⏩ ${number} already connected`));
                continue;
            }

            console.log(fancy(`🔄 Reconnecting ${number} from MongoDB...`));
            
            try {
                // Load session from MongoDB
                const sessionData = await loadSessionFromMongoDB(number);
                
                if (!sessionData) {
                    console.log(fancy(`⚠️ No session data for ${number}, skipping...`));
                    continue;
                }

                // Create session folder
                const sessionPath = path.join(__dirname, 'sessions', `session_${number}`);
                if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
                    fs.mkdirSync(path.join(__dirname, 'sessions'), { recursive: true });
                }
                if (!fs.existsSync(sessionPath)) {
                    fs.mkdirSync(sessionPath, { recursive: true });
                }

                // Save creds to file
                fs.writeFileSync(
                    path.join(sessionPath, 'creds.json'),
                    JSON.stringify(sessionData.creds, null, 2)
                );

                // Create new connection
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
                    markOnlineOnConnect: true
                });

                // Store connection
                activeSockets.set(number, conn);
                socketCreationTime.set(number, Date.now());

                // Handle connection updates
                conn.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect } = update;
                    
                    if (connection === 'open') {
                        console.log(fancy(`✅ ${number} reconnected successfully`));
                        
                        // Update session activity
                        await Session.findOneAndUpdate(
                            { sessionId: number },
                            { 
                                $set: { 
                                    lastActive: new Date(),
                                    isActive: true 
                                }
                            }
                        );

                        // Send notification
                        try {
                            const userJid = conn.user?.id;
                            if (userJid) {
                                await conn.sendMessage(userJid, {
                                    text: `🔄 *Auto-Reconnected*\n\n✅ Bot has been automatically reconnected from MongoDB backup.`
                                });
                            }
                        } catch (notifyError) {
                            console.error("Failed to send reconnect notification:", notifyError.message);
                        }
                    }

                    if (connection === 'close') {
                        const statusCode = lastDisconnect?.error?.output?.statusCode;
                        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                        
                        if (shouldReconnect) {
                            console.log(fancy(`🔄 ${number} disconnected, reconnecting in 5s...`));
                            activeSockets.delete(number);
                            socketCreationTime.delete(number);
                            setTimeout(() => autoReconnectFromMongoDB(), 5000);
                        } else {
                            console.log(fancy(`🚫 ${number} logged out, removing from MongoDB`));
                            await deleteSessionFromMongoDB(number);
                            activeSockets.delete(number);
                            socketCreationTime.delete(number);
                        }
                    }
                });

                // Handle creds update
                conn.ev.on('creds.update', async () => {
                    if (conn.authState?.creds) {
                        await saveCreds();
                        await saveSessionToMongoDB(number, conn.authState.creds, {});
                    }
                });

                // Add small delay between reconnections
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (connError) {
                console.error(fancy(`❌ Failed to reconnect ${number}:`), connError.message);
                // Mark as inactive in MongoDB
                await Session.findOneAndUpdate(
                    { sessionId: number },
                    { $set: { isActive: false } }
                );
            }
        }

        console.log(fancy("✅ Auto-reconnect process completed"));

    } catch (error) {
        console.error(fancy("❌ Auto-reconnect error:"), error.message);
    }
}

// ✅ **START BOT**
startBot();

// ✅ **START AUTO RECONNECT - KAMA ILIVYO KWENYE CODE YAKO**
setTimeout(() => {
    autoReconnectFromMongoDB();
}, 10000); // Wait 10 seconds before starting auto-reconnect

// Run auto-reconnect every 30 minutes
setInterval(() => {
    console.log(fancy("🔄 Running scheduled auto-reconnect check..."));
    autoReconnectFromMongoDB();
}, 30 * 60 * 1000);

// ==================== HTTP ENDPOINTS ====================

// ✅ **PAIRING ENDPOINT**
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }
        
        if (!globalConn) {
            return res.json({ success: false, error: "Bot is initializing. Please try again in a few seconds." });
        }
        
        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));
        
        const code = await Promise.race([
            globalConn.requestPairingCode(cleanNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout - no response from WhatsApp')), 30000))
        ]);
        
        res.json({ 
            success: true, 
            code: code,
            message: `8-digit pairing code: ${code}`
        });
        
    } catch (err) {
        console.error("Pairing error:", err.message);
        if (err.message.includes("already paired")) {
            res.json({ success: true, message: "Number already paired" });
        } else {
            res.json({ success: false, error: "Failed: " + err.message });
        }
    }
});

// ✅ **UNPAIR ENDPOINT**
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /unpair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number" });
        }
        
        let result = false;
        if (handler && handler.unpairNumber) {
            result = await handler.unpairNumber(cleanNum);
        } else {
            return res.json({ success: false, error: "Unpair function not available in handler" });
        }
        
        await deleteSessionFromMongoDB(cleanNum);
        
        res.json({ 
            success: result, 
            message: result ? `Number ${cleanNum} unpaired successfully` : `Failed to unpair ${cleanNum}`
        });
        
    } catch (err) {
        console.error("Unpair error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ **ACTIVE SESSIONS ENDPOINT**
app.get('/active', (req, res) => {
    res.json({
        success: true,
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

// ✅ **RECONNECT ALL ENDPOINT**
app.get('/reconnect-all', async (req, res) => {
    try {
        await autoReconnectFromMongoDB();
        res.json({
            success: true,
            message: "Reconnect process started",
            activeCount: activeSockets.size
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ✅ **HEALTH CHECK**
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        status: 'healthy',
        connected: isConnected,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        mongodb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
        activeSessions: activeSockets.size
    });
});

// ✅ **BOT INFO ENDPOINT**
app.get('/botinfo', (req, res) => {
    if (!globalConn || !globalConn.user) {
        return res.json({ 
            success: false,
            error: "Bot not connected",
            connected: isConnected
        });
    }
    
    const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
    const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
    
    res.json({
        success: true,
        botName: globalConn.user?.name || "INSIDIOUS",
        botNumber: globalConn.user?.id?.split(':')[0] || "Unknown",
        botJid: globalConn.user?.id || "Unknown",
        botSecret: botSecret,
        pairedOwners: pairedCount,
        connected: isConnected,
        uptime: Date.now() - botStartTime,
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        activeSessions: activeSockets.size
    });
});

// ✅ **MONGODB STATS ENDPOINT**
app.get('/dbstats', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const groupCount = await Group.countDocuments();
        const sessionCount = await Session.countDocuments();
        const activeSessionCount = await Session.countDocuments({ isActive: true });
        const settingsCount = await Settings.countDocuments();
        
        res.json({
            success: true,
            connected: mongoose.connection.readyState === 1,
            stats: {
                users: userCount,
                groups: groupCount,
                sessions: {
                    total: sessionCount,
                    active: activeSessionCount
                },
                settings: settingsCount
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ✅ **GET ALL USERS**
app.get('/users', async (req, res) => {
    try {
        const users = await User.find().sort({ lastActive: -1 }).limit(100);
        res.json({
            success: true,
            count: users.length,
            users: users
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ✅ **GET ALL GROUPS**
app.get('/groups', async (req, res) => {
    try {
        const groups = await Group.find().sort({ joinedAt: -1 });
        res.json({
            success: true,
            count: groups.length,
            groups: groups
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ✅ **GET ALL SESSIONS**
app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.find().sort({ lastActive: -1 });
        res.json({
            success: true,
            count: sessions.length,
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                lastActive: s.lastActive,
                isActive: s.isActive,
                createdAt: s.createdAt
            }))
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ✅ **UPDATE SETTINGS**
app.post('/settings', express.json(), async (req, res) => {
    try {
        const newSettings = req.body;
        
        const settings = await Settings.findOneAndUpdate(
            {},
            { $set: newSettings },
            { upsert: true, new: true }
        );
        
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ✅ **GET SETTINGS**
app.get('/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = await Settings.create({});
        }
        
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ✅ **CLEANUP ON EXIT**
process.on('exit', () => {
    console.log(fancy("🛑 Cleaning up before exit..."));
    activeSockets.forEach((socket, number) => {
        if (socket.ws) socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
});

process.on('uncaughtException', (err) => {
    console.error(fancy("❌ Uncaught exception:"), err);
    // Don't exit, let the process continue
});

process.on('unhandledRejection', (err) => {
    console.error(fancy("❌ Unhandled rejection:"), err);
    // Don't exit, let the process continue
});

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo`));
    console.log(fancy(`📊 DB Stats: http://localhost:${PORT}/dbstats`));
    console.log(fancy(`👥 Users: http://localhost:${PORT}/users`));
    console.log(fancy(`👥 Groups: http://localhost:${PORT}/groups`));
    console.log(fancy(`📦 Sessions: http://localhost:${PORT}/sessions`));
    console.log(fancy(`🔄 Active: http://localhost:${PORT}/active`));
    console.log(fancy(`🔄 Reconnect All: http://localhost:${PORT}/reconnect-all`));
    console.log(fancy(`⚙️ Settings: http://localhost:${PORT}/settings`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    console.log(fancy("📦 Storage: MongoDB Only"));
    console.log(fancy("🔄 Auto-Reconnect: Active (Every 30 mins)"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
});

module.exports = app;