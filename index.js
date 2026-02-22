const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason,
    useMongoDBAuthState  // Muhimu kwa MongoDB auth
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const NodeCache = require('node-cache');

// ==================== HANDLER ====================
const handler = require('./handler');

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
        
        return text.split('').map(char => fancyMap[char] || char).join('');
    } catch (e) {
        return text;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MESSAGE RETRY CACHE**
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

// ✅ **GLOBAL STATE MANAGEMENT**
const state = {
    conn: null,
    isConnected: false,
    botStartTime: Date.now(),
    pairingInProgress: false,  // Zuia multiple pairing simultaneously
    restartAttempts: 0,
    maxRestartAttempts: 5
};

// ✅ **MONGODB CONNECTION**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

// Schema kwa session storage
const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    data: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const SessionModel = mongoose.model('Session', SessionSchema);

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED: " + err.message));
    // Endelea bila MongoDB - fallback kwa file system
});

// ✅ **CUSTOM AUTH STATE FOR MONGODB**
async function useMongoAuthState(sessionId = 'insidious_session') {
    const defaultState = {
        creds: {},
        keys: {}
    };

    // Soma kutoka MongoDB
    const readData = async () => {
        try {
            const doc = await SessionModel.findOne({ sessionId });
            if (doc && doc.data) {
                return {
                    creds: doc.data.creds || {},
                    keys: doc.data.keys || {}
                };
            }
        } catch (e) {
            console.log(fancy("⚠️ MongoDB read failed, using file fallback"));
        }
        
        // Fallback kwa file system
        try {
            const filePath = path.join(__dirname, 'insidious_session', 'creds.json');
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return { creds: data, keys: {} };
            }
        } catch (e) {}
        
        return defaultState;
    };

    // Andika kwenye MongoDB
    const writeData = async (data) => {
        try {
            await SessionModel.findOneAndUpdate(
                { sessionId },
                { 
                    sessionId,
                    data: {
                        creds: data.creds,
                        keys: data.keys
                    },
                    updatedAt: new Date()
                },
                { upsert: true, new: true }
            );
        } catch (e) {
            console.log(fancy("⚠️ MongoDB write failed, using file fallback"));
            // Fallback kwa file
            const dir = path.join(__dirname, 'insidious_session');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(
                path.join(dir, 'creds.json'),
                JSON.stringify(data.creds, null, 2)
            );
        }
    };

    const data = await readData();

    return {
        state: {
            creds: data.creds,
            keys: makeCacheableSignalKeyStore(data.keys, pino({ level: "fatal" }))
        },
        saveCreds: async () => {
            await writeData({
                creds: data.creds,
                keys: data.keys
            });
        }
    };
}

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ✅ **MAIN BOT FUNCTION**
async function startBot() {
    try {
        // Zuia multiple instances
        if (state.conn) {
            console.log(fancy("⚠️ Bot already running, skipping restart"));
            return;
        }

        console.log(fancy("🚀 Starting INSIDIOUS..."));
        
        // ✅ **AUTHENTICATION - MongoDB Priority**
        let authState;
        try {
            authState = await useMongoAuthState();
            console.log(fancy("✅ Using MongoDB Auth State"));
        } catch (e) {
            console.log(fancy("⚠️ Falling back to File Auth State"));
            authState = await useMultiFileAuthState('insidious_session');
        }

        const { version } = await fetchLatestBaileysVersion();

        // ✅ **CREATE CONNECTION - IMPROVED CONFIG**
        const conn = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            auth: {
                creds: authState.state.creds,
                keys: makeCacheableSignalKeyStore(authState.state.keys, pino({ level: "fatal" }))
            },
            browser: Browsers.macOS("Safari"),
            msgRetryCounterCache,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,  // Ongeza keep-alive
            markOnlineOnConnect: true,
            defaultQueryTimeoutMs: 20000,
            // Muhimu kwa multi-device stability
            shouldSyncHistoryMessage: () => false,
            shouldIgnoreJid: jid => jid?.includes('broadcast'),
            // Retry configuration
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 5,
            fireInitQueries: true,
            // App state sync
            appStateMacVerification: {
                patch: true,
                snapshot: true
            }
        });

        state.conn = conn;
        state.botStartTime = Date.now();
        state.restartAttempts = 0;

        // ✅ **CONNECTION EVENT HANDLER - IMPROVED**
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(fancy("📱 QR Code generated - ready for scanning"));
            }

            if (connection === 'open') {
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
                console.log(fancy("✅ Bot is now online"));
                
                state.isConnected = true;
                state.restartAttempts = 0;
                
                const botName = conn.user?.name || "INSIDIOUS";
                const botNumber = conn.user?.id?.split(':')[0] || "Unknown";
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
                
                // ✅ **SEND WELCOME MESSAGE**
                setTimeout(async () => {
                    try {
                        if (config.ownerNumber?.length > 0) {
                            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
                            if (ownerNum.length >= 10) {
                                const ownerJid = ownerNum + '@s.whatsapp.net';
                                
                                const welcomeMsg = `╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🆔 *Bot ID:* ${botSecret}
👥 *Paired Owners:* ${pairedCount}

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
📁 *Database:* Connected
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
                state.isConnected = false;
                state.conn = null;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || '';
                
                console.log(fancy(`📊 Disconnect reason: ${statusCode} - ${errorMessage}`));
                
                // Handling specific error codes
                const shouldReconnect = ![
                    DisconnectReason.loggedOut,
                    DisconnectReason.badSession,
                    DisconnectReason.forbidden
                ].includes(statusCode);

                if (shouldReconnect && state.restartAttempts < state.maxRestartAttempts) {
                    state.restartAttempts++;
                    const delay = Math.min(state.restartAttempts * 5000, 30000); // Exponential backoff
                    
                    console.log(fancy(`🔄 Restarting bot in ${delay/1000}s... (Attempt ${state.restartAttempts}/${state.maxRestartAttempts})`));
                    
                    setTimeout(() => {
                        startBot();
                    }, delay);
                } else if (state.restartAttempts >= state.maxRestartAttempts) {
                    console.log(fancy("❌ Max restart attempts reached. Manual intervention required."));
                } else {
                    console.log(fancy("🚫 Logged out or bad session. Please scan QR or pair again."));
                    // Clear session if logged out
                    if (statusCode === DisconnectReason.loggedOut) {
                        try {
                            await SessionModel.deleteOne({ sessionId: 'insidious_session' });
                            console.log(fancy("🗑️ Session cleared from database"));
                        } catch (e) {}
                    }
                }
            }
        });

        // ✅ **CREDENTIALS UPDATE - SAVE TO MONGODB**
        conn.ev.on('creds.update', async () => {
            try {
                await authState.saveCreds();
            } catch (e) {
                console.error(fancy("❌ Failed to save credentials:"), e.message);
            }
        });

        // ✅ **MESSAGE HANDLER**
        conn.ev.on('messages.upsert', async (m) => {
            try {
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
                if (handler?.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update);
                }
            } catch (error) {
                console.error("Group update error:", error.message);
            }
        });

        // ✅ **CALL HANDLER**
        conn.ev.on('call', async (call) => {
            try {
                if (handler?.handleCall) {
                    await handler.handleCall(conn, call);
                }
            } catch (error) {
                console.error("Call handler error:", error.message);
            }
        });

        console.log(fancy("🚀 Bot ready for pairing via web interface"));
        
    } catch (error) {
        console.error("Start error:", error.message);
        state.conn = null;
        state.isConnected = false;
        
        if (state.restartAttempts < state.maxRestartAttempts) {
            state.restartAttempts++;
            setTimeout(() => startBot(), 10000);
        }
    }
}

// ✅ **START BOT**
startBot();

// ==================== HTTP ENDPOINTS ====================

// ✅ **IMPROVED PAIRING ENDPOINT**
app.get('/pair', async (req, res) => {
    try {
        // Zuia multiple pairing simultaneously
        if (state.pairingInProgress) {
            return res.json({ 
                success: false, 
                error: "Another pairing is in progress. Please wait..." 
            });
        }

        let num = req.query.num;
        if (!num) {
            return res.json({ 
                success: false, 
                error: "Provide number! Example: /pair?num=255123456789" 
            });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ 
                success: false, 
                error: "Invalid number. Must be at least 10 digits." 
            });
        }
        
        if (!state.conn) {
            return res.json({ 
                success: false, 
                error: "Bot is initializing. Please try again in a few seconds." 
            });
        }

        if (!state.isConnected) {
            return res.json({
                success: false,
                error: "Bot is not fully connected yet. Please wait..."
            });
        }
        
        state.pairingInProgress = true;
        console.log(fancy(`🔑 Generating pairing code for: ${cleanNum}`));
        
        try {
            // Tengeneza pairing code
            const code = await state.conn.requestPairingCode(cleanNum);
            
            console.log(fancy(`✅ Pairing code generated: ${code}`));
            
            res.json({ 
                success: true, 
                code: code,
                number: cleanNum,
                message: `Pairing code: ${code}`,
                instructions: "Open WhatsApp > Settings > Linked Devices > Link a Device > Link with phone number instead"
            });
            
        } catch (err) {
            console.error(fancy("❌ Pairing failed:"), err.message);
            
            // Specific error handling
            if (err.message?.includes("already paired") || err.output?.statusCode === 409) {
                res.json({ 
                    success: true, 
                    alreadyPaired: true,
                    message: "Number is already paired with this bot" 
                });
            } else if (err.message?.includes("timeout") || err.message?.includes("Timed out")) {
                res.json({ 
                    success: false, 
                    error: "Request timed out. WhatsApp servers may be busy. Please try again." 
                });
            } else {
                res.json({ 
                    success: false, 
                    error: "Failed to generate code: " + err.message 
                });
            }
        } finally {
            // Release lock after 10 seconds (cooldown)
            setTimeout(() => {
                state.pairingInProgress = false;
            }, 10000);
        }
        
    } catch (err) {
        state.pairingInProgress = false;
        console.error("Pairing endpoint error:", err.message);
        res.json({ success: false, error: "Server error: " + err.message });
    }
});

// ✅ **UNPAIR ENDPOINT**
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ 
                success: false, 
                error: "Provide number! Example: /unpair?num=255123456789" 
            });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number" });
        }
        
        let result = false;
        if (handler?.unpairNumber) {
            result = await handler.unpairNumber(cleanNum);
        } else {
            return res.json({ 
                success: false, 
                error: "Unpair function not available in handler" 
            });
        }
        
        res.json({ 
            success: result, 
            message: result ? `Number ${cleanNum} unpaired successfully` : `Failed to unpair ${cleanNum}`
        });
        
    } catch (err) {
        console.error("Unpair error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ **HEALTH CHECK - IMPROVED**
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        status: 'healthy',
        connected: state.isConnected,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        pairingInProgress: state.pairingInProgress,
        restartAttempts: state.restartAttempts,
        timestamp: new Date().toISOString()
    });
});

// ✅ **BOT INFO ENDPOINT**
app.get('/botinfo', (req, res) => {
    if (!state.conn?.user) {
        return res.json({ 
            success: false,
            error: "Bot not connected",
            connected: state.isConnected,
            uptime: Date.now() - state.botStartTime
        });
    }
    
    const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
    const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
    
    res.json({
        success: true,
        botName: state.conn.user?.name || "INSIDIOUS",
        botNumber: state.conn.user?.id?.split(':')[0] || "Unknown",
        botJid: state.conn.user?.id || "Unknown",
        botSecret: botSecret,
        pairedOwners: pairedCount,
        connected: state.isConnected,
        uptime: Date.now() - state.botStartTime,
        platform: state.conn.user?.platform || 'unknown'
    });
});

// ✅ **FORCE RECONNECT ENDPOINT (For emergencies)**
app.get('/reconnect', async (req, res) => {
    try {
        if (state.conn) {
            state.conn.end();
            state.conn = null;
        }
        state.isConnected = false;
        
        setTimeout(() => startBot(), 2000);
        
        res.json({ success: true, message: "Reconnecting bot..." });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy(`🔄 Reconnect: http://localhost:${PORT}/reconnect`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.2 | MongoDB Edition"));
});

module.exports = app;
