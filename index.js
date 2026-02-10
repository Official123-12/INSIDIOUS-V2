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
const path = require("path");
const { fancy } = require("./lib/font");

// LOAD YOUR EXISTING FILES
const config = require("./config");
const handler = require("./handler");

const app = express();
const PORT = config.port || 3000;

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// WEB ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API ENDPOINTS
app.get('/api/stats', (req, res) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        success: true,
        uptime: uptime,
        uptimeFormatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        version: config.version,
        botName: config.botName,
        developer: config.developerName || "STANY",
        connectionStatus: connectionStatus,
        sleepingMode: sleepingMode,
        readyForPairing: isConnectionReady,
        owner: botOwnerJid ? botOwnerJid.split('@')[0] : "Not connected",
        timestamp: new Date().toISOString()
    });
});

let globalConn = null;
let connectionStatus = 'disconnected';
let isConnectionReady = false;
let botOwnerJid = null;

// ============================================
// SLEEPING MODE VARIABLES
// ============================================
let sleepingMode = false;
let sleepStartTime = "00:00";
let sleepEndTime = "06:00";
let sleepInterval = null;

// ============================================
// WAIT FOR CONNECTION FUNCTION - IMPROVED
// ============================================
function waitForConnection(timeout = 45000) {
    return new Promise((resolve, reject) => {
        // If already connected, resolve immediately
        if (isConnectionReady && globalConn) {
            return resolve(true);
        }
        
        const startTime = Date.now();
        let attempts = 0;
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (isConnectionReady && globalConn) {
                clearInterval(checkInterval);
                console.log(fancy(`✅ Connection ready after ${attempts} seconds`));
                resolve(true);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.log(fancy(`❌ Connection timeout after ${timeout}ms`));
                reject(new Error(`Connection timeout. Status: ${connectionStatus}`));
            } else {
                // Show progress every 5 seconds
                if (attempts % 5 === 0) {
                    console.log(fancy(`⏳ Still connecting... ${attempts}s elapsed`));
                }
            }
        }, 1000);
    });
}

// ============================================
// SLEEPING MODE FUNCTIONS
// ============================================
function startSleepingMode() {
    try {
        if (!globalConn || sleepingMode) return;
        
        sleepingMode = true;
        console.log(fancy("😴 Sleeping Mode ACTIVATED"));
        
        if (botOwnerJid) {
            globalConn.sendMessage(botOwnerJid, {
                text: fancy(`😴 *SLEEPING MODE ACTIVATED*\n\n⏰ Active: ${sleepStartTime} - ${sleepEndTime}\n📵 Group functions paused\n\nBot will resume at ${sleepEndTime}`)
            });
        }
        
    } catch (error) {
        console.error("Sleep mode error:", error.message);
    }
}

function stopSleepingMode() {
    try {
        if (!globalConn || !sleepingMode) return;
        
        sleepingMode = false;
        console.log(fancy("🌅 Sleeping Mode DEACTIVATED"));
        
        if (botOwnerJid) {
            globalConn.sendMessage(botOwnerJid, {
                text: fancy(`🌅 *SLEEPING MODE DEACTIVATED*\n\n✅ All functions ACTIVE\n⚡ Bot is fully operational`)
            });
        }
        
    } catch (error) {
        console.error("Wake up error:", error.message);
    }
}

function checkSleepingMode() {
    try {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMinute] = sleepStartTime.split(':').map(Number);
        const [endHour, endMinute] = sleepEndTime.split(':').map(Number);
        
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;
        
        if (startTime <= endTime) {
            if (currentTime >= startTime && currentTime <= endTime) {
                if (!sleepingMode) startSleepingMode();
            } else {
                if (sleepingMode) stopSleepingMode();
            }
        } else {
            if (currentTime >= startTime || currentTime <= endTime) {
                if (!sleepingMode) startSleepingMode();
            } else {
                if (sleepingMode) stopSleepingMode();
            }
        }
    } catch (error) {
        console.error("Check sleeping mode error:", error.message);
    }
}

// ============================================
// ANTI-CALL HANDLER
// ============================================
async function handleAntiCall(conn, call) {
    try {
        const callData = call[0];
        if (!callData) return;
        
        const caller = callData.from;
        const callId = callData.id;
        const isVideo = callData.isVideo || false;
        
        // Reject the call immediately
        await conn.rejectCall(callId, caller);
        
        // Log it
        console.log(fancy(`📵 Rejected ${isVideo ? 'Video' : 'Voice'} call from: ${caller.split('@')[0]}`));
        
        // Send notification to owner
        if (botOwnerJid) {
            await conn.sendMessage(botOwnerJid, {
                text: fancy(`📵 *CALL REJECTED*\n\n📞 From: ${caller}\n⏰ Time: ${new Date().toLocaleString()}\n🎥 Type: ${isVideo ? 'Video Call' : 'Voice Call'}\n\n⚠️ Call was automatically rejected`)
            });
        }
        
    } catch (error) {
        console.error("Anti-call error:", error.message);
    }
}

// ============================================
// START BOT FUNCTION
// ============================================
async function startInsidious() {
    try {
        console.log(fancy("🔗 Starting WhatsApp connection..."));
        
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
            getMessage: async (key) => ({ conversation: "message deleted" }),
            printQRInTerminal: false // NO QR CODE
        });

        globalConn = conn;

        // ============================================
        // CALL EVENT HANDLER
        // ============================================
        conn.ev.on('call', async (call) => {
            try {
                if (config.anticall) {
                    await handleAntiCall(conn, call);
                }
            } catch (error) {
                console.error("Call event error:", error.message);
            }
        });

        // ============================================
        // CONNECTION UPDATE HANDLER
        // ============================================
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy("✅ WhatsApp connected successfully!"));
                console.log(fancy("🎉 Bot is now ready for pairing!"));
                connectionStatus = 'connected';
                isConnectionReady = true;
                
                // Set bot owner (person who linked)
                if (conn.user && conn.user.id) {
                    botOwnerJid = conn.user.id;
                    const ownerNumber = botOwnerJid.split('@')[0];
                    console.log(fancy(`👑 Bot Owner: ${ownerNumber}`));
                    console.log(fancy(`👨‍💻 Developer: ${config.developerName || "STANY"}`));
                    
                    // Send welcome message to owner
                    const welcomeMsg = `╔═══════════════════╗
   🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}*
╚═══════════════════╝

✅ *Bot Online Successfully!*
👑 *Owner:* ${ownerNumber}
👨‍💻 *Developer:* ${config.developerName || "STANY"}
🕐 *Start Time:* ${new Date().toLocaleString()}

📢 *Bot Features:*
• Anti-Link Protection ✓
• Anti-Scam Protection ✓  
• Welcome/Goodbye Messages ✓
• Sleeping Mode ✓
• Anti-Call System ✓
• Channel Auto-React ✓
• Status Download ✓
• AI Chatbot ✓
• 30+ More Features!

🔗 *Pairing URL:*
http://localhost:${PORT}?num=${ownerNumber}

${fancy(config.footer || "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ | STANY")}`;
                    
                    await conn.sendMessage(botOwnerJid, { text: welcomeMsg });
                    
                    // Start sleeping mode checker
                    if (sleepInterval) clearInterval(sleepInterval);
                    sleepInterval = setInterval(checkSleepingMode, 60000);
                    checkSleepingMode();
                    
                    console.log(fancy(`📱 Owner can pair at: http://localhost:${PORT}`));
                }
                
                // Initialize handler
                if (handler && handler.init) {
                    try {
                        await handler.init(conn);
                    } catch (e) {
                        console.error("Handler init error:", e.message);
                    }
                }
                
                // Start auto bio
                if (config.autoBio) {
                    setTimeout(() => updateBio(conn), 3000);
                }
            }
            
            if (connection === 'close') {
                console.log(fancy("🔌 Connection closed"));
                connectionStatus = 'disconnected';
                isConnectionReady = false;
                
                // Clear sleeping mode interval
                if (sleepInterval) {
                    clearInterval(sleepInterval);
                    sleepInterval = null;
                }
                
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log(fancy("🔄 Reconnecting in 3 seconds..."));
                    setTimeout(startInsidious, 3000);
                } else {
                    console.log(fancy("❌ Logged out - Manual login required"));
                }
            }
            
            if (connection === 'connecting') {
                connectionStatus = 'connecting';
                console.log(fancy("⏳ Connecting to WhatsApp..."));
            }
        });

        // ============================================
        // CREDENTIALS UPDATE
        // ============================================
        conn.ev.on('creds.update', saveCreds);

        // ============================================
        // MESSAGE HANDLER
        // ============================================
        conn.ev.on('messages.upsert', async (m) => {
            try {
                // Check sleeping mode before processing
                if (sleepingMode) {
                    const from = m.messages[0]?.key?.remoteJid;
                    if (from && from.endsWith('@g.us')) {
                        console.log(fancy("😴 Sleeping Mode - Skipping group message"));
                        return;
                    }
                }
                
                if (handler && typeof handler === 'function') {
                    await handler(conn, m);
                }
            } catch (error) {
                console.error("Handler error:", error.message);
            }
        });

        // ============================================
        // GROUP PARTICIPANTS UPDATE
        // ============================================
        conn.ev.on('group-participants.update', async (anu) => {
            try {
                if (sleepingMode) {
                    console.log(fancy("😴 Sleeping Mode - Skipping group event"));
                    return;
                }
                
                if (!config.welcomeGoodbye) return;
                
                const metadata = await conn.groupMetadata(anu.id);
                
                for (let num of anu.participants) {
                    const userNum = num.split("@")[0];
                    
                    if (anu.action == 'add') {
                        const welcomeMsg = `
╭─── • 🎉 • ───╮
   𝗪𝗘𝗟𝗖𝗢𝗠𝗘
╰─── • 🎉 • ───╯

👋 *Hello* @${userNum}!
📛 *Group:* ${metadata.subject}
👥 *Members:* ${metadata.participants.length}
🕐 *Joined:* ${new Date().toLocaleString()}

⚡ *Enjoy your stay!*

${fancy(config.footer || "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ")}`;
                        
                        await conn.sendMessage(anu.id, { 
                            text: welcomeMsg,
                            mentions: [num] 
                        });
                        
                        console.log(fancy(`🎉 Welcomed new member: ${userNum}`));
                        
                    } else if (anu.action == 'remove') {
                        const goodbyeMsg = `
╭─── • 👋 • ───╮
   𝗚𝗢𝗢𝗗𝗕𝗬𝗘
╰─── • 👋 • ───╯

📛 *Group:* ${metadata.subject}
👥 *Remaining:* ${metadata.participants.length}
🕐 *Left:* ${new Date().toLocaleString()}

😔 @${userNum} has left.

${fancy(config.footer || "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ")}`;
                        
                        await conn.sendMessage(anu.id, { 
                            text: goodbyeMsg,
                            mentions: [num] 
                        });
                        
                        console.log(fancy(`👋 Said goodbye to: ${userNum}`));
                    }
                }
            } catch (e) {
                console.error("Group event error:", e.message);
            }
        });

        return conn;
        
    } catch (error) {
        console.error("Startup error:", error.message);
        setTimeout(startInsidious, 5000);
    }
}

// ============================================
// AUTO BIO FUNCTION
// ============================================
async function updateBio(conn) {
    try {
        if (!conn) return;
        
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const bioText = `🤖 ${config.botName} | ⚡ ${days}d ${hours}h ${minutes}m | 👑 ${config.developerName || "STANY"} | 🎯 V${config.version}`;
        
        await conn.updateProfileStatus(bioText);
        console.log(fancy(`📝 Bio updated: ${bioText}`));
        
        // Update every minute
        setInterval(async () => {
            try {
                const uptime = process.uptime();
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor((uptime % 86400) / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                
                const bioText = `🤖 ${config.botName} | ⚡ ${days}d ${hours}h ${minutes}m | 👑 ${config.developerName || "STANY"} | 🎯 V${config.version}`;
                await conn.updateProfileStatus(bioText);
            } catch (e) {
                // Silent fail
            }
        }, 60000);
        
    } catch (error) {
        console.error("Bio error:", error.message);
    }
}

// ============================================
// PAIRING ENDPOINT - FOR YOUR WEB
// ============================================
app.get('/pair', async (req, res) => {
    try {
        console.log(fancy("🔐 Pairing request received"));
        
        let num = req.query.num;
        if (!num) {
            return res.json({ 
                success: false, 
                error: "Enter your WhatsApp number! Example: /pair?num=255618558502" 
            });
        }
        
        // Clean number
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (!cleanNum || cleanNum.length < 9) {
            return res.json({ 
                success: false, 
                error: "Invalid number! Use: 255xxxxxxxxx (with country code)" 
            });
        }
        
        // Wait for connection if needed
        if (!isConnectionReady || !globalConn) {
            console.log(fancy("⏳ Bot not ready, waiting for connection..."));
            
            try {
                await waitForConnection(45000);
                console.log(fancy("✅ Connection ready for pairing!"));
            } catch (waitError) {
                return res.json({ 
                    success: false, 
                    error: "Bot is starting up. Please wait 30 seconds and try again.",
                    details: "WhatsApp connection takes 30-45 seconds",
                    tip: "Refresh page and try again in 30 seconds"
                });
            }
        }
        
        console.log(fancy(`📱 Generating pairing code for: ${cleanNum}`));
        
        try {
            // Generate pairing code
            const code = await globalConn.requestPairingCode(cleanNum);
            
            if (!code) {
                return res.json({ 
                    success: false, 
                    error: "Failed to generate pairing code. Please check the number format." 
                });
            }
            
            // Format to 8 digits
            const formattedCode = code.toString().padStart(8, '0').slice(0, 8);
            
            console.log(fancy(`✅ Pairing code generated: ${formattedCode} for ${cleanNum}`));
            
            // Send success response (FORMAT FOR YOUR WEB)
            res.json({ 
                success: true, 
                code: formattedCode,
                message: "Pairing code generated successfully!",
                timestamp: new Date().toISOString(),
                expiresIn: "60 seconds",
                instructions: [
                    "1. Open WhatsApp on your phone",
                    "2. Go to Settings → Linked Devices",
                    "3. Tap 'Link a Device'",
                    "4. Enter the 8-digit code",
                    "5. You will become the bot owner!"
                ]
            });
            
        } catch (pairError) {
            console.error("Pairing error:", pairError.message);
            
            let errorMsg = "Pairing failed. ";
            if (pairError.message.includes("not registered")) {
                errorMsg += "This number may not be registered on WhatsApp.";
            } else if (pairError.message.includes("rate limit")) {
                errorMsg += "Too many attempts. Wait 1 minute before trying again.";
            } else if (pairError.message.includes("timed out")) {
                errorMsg += "Request timed out. Try again.";
            } else {
                errorMsg += "Please check your number and try again.";
            }
            
            res.json({ 
                success: false, 
                error: errorMsg
            });
        }
        
    } catch (err) {
        console.error("Pairing endpoint error:", err.message);
        res.json({ 
            success: false, 
            error: "Server error occurred. Please try again.",
            details: err.message 
        });
    }
});

// ============================================
// SIMPLE STATUS CHECK (FOR WEB)
// ============================================
app.get('/api/check', (req, res) => {
    res.json({ 
        online: isConnectionReady,
        status: connectionStatus,
        botName: config.botName,
        version: config.version,
        developer: config.developerName || "STANY",
        message: isConnectionReady ? "✅ Bot is ready for pairing!" : "⏳ Bot is connecting...",
        timestamp: new Date().toISOString()
    });
});

// ============================================
// SLEEPING MODE CONTROLS
// ============================================
app.get('/api/sleep', (req, res) => {
    const { action, start, end } = req.query;
    
    if (action === 'set' && start && end) {
        sleepStartTime = start;
        sleepEndTime = end;
        checkSleepingMode();
        
        res.json({ 
            success: true, 
            message: `Sleeping mode updated: ${start} to ${end}`,
            sleepingMode: sleepingMode,
            currentStatus: sleepingMode ? "😴 ACTIVE" : "🌅 INACTIVE"
        });
    } else if (action === 'status') {
        res.json({ 
            sleepingMode,
            sleepStartTime,
            sleepEndTime,
            currentTime: new Date().toLocaleTimeString()
        });
    } else {
        res.json({ 
            success: false, 
            error: "Invalid parameters",
            example: "/api/sleep?action=set&start=22:00&end=06:00"
        });
    }
});

// ============================================
// HEALTH CHECK (FOR DEPLOYMENT)
// ============================================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online',
        bot: config.botName,
        version: config.version,
        connection: connectionStatus,
        ready: isConnectionReady,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: "Endpoint not found",
        availableEndpoints: [
            "/ - Pairing page",
            "/pair?num=255xxxx - Get pairing code",
            "/api/stats - Bot statistics",
            "/api/check - Quick status check",
            "/health - Health check"
        ]
    });
});

// ============================================
// START BOT
// ============================================
console.log(fancy("╔══════════════════════════════════════╗"));
console.log(fancy(`          🥀 ${config.botName} V${config.version} 🥀          `));
console.log(fancy("╚══════════════════════════════════════╝"));
console.log(fancy(`👨‍💻 Developer: ${config.developerName || "STANY"}`));
console.log(fancy(`⚡ Starting INSIDIOUS V2...`));

startInsidious();

// ============================================
// START EXPRESS SERVER
// ============================================
const server = app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Server: http://localhost:${PORT}`));
    console.log(fancy(`🔐 Pairing: http://localhost:${PORT}?num=YOUR_NUMBER`));
    console.log(fancy(`📊 Stats: http://localhost:${PORT}/api/stats`));
    console.log(fancy(`🩺 Health: http://localhost:${PORT}/health`));
    console.log(fancy("⏳ Connecting to WhatsApp... (30-45 seconds)"));
    console.log(fancy("💡 Wait for '✅ WhatsApp connected' message"));
    console.log(fancy("🎯 Then use the pairing page to link your device"));
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', () => {
    console.log(fancy('🔄 SIGTERM received, shutting down'));
    server.close(() => {
        console.log(fancy('✅ Server closed'));
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log(fancy('🔄 SIGINT received, shutting down'));
    server.close(() => {
        console.log(fancy('✅ Server closed'));
        process.exit(0);
    });
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('uncaughtException', (error) => {
    console.error(fancy("⚠️ Uncaught Exception:"), error.message);
});

process.on('unhandledRejection', (error) => {
    console.error(fancy("⚠️ Unhandled Rejection:"), error.message);
});
