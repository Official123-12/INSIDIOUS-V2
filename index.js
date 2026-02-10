const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const { fancy } = require("./lib/font");
const path = require("path");
const fs = require('fs-extra');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// FIX MONGODB WARNING - Remove deprecated options
console.log(fancy("🔗 Connecting to database..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log(fancy("✅ Database Connected Successfully"));
    
    // Create default settings if not exist
    setTimeout(async () => {
        try {
            const { Settings } = require('./database/models');
            const settings = await Settings.findOne();
            if (!settings) {
                await new Settings().save();
                console.log(fancy("⚙️ Default settings created"));
            }
        } catch (e) {
            console.log(fancy("⚠️ Could not create default settings"));
        }
    }, 2000);
})
.catch((err) => {
    console.log(fancy("⚠️ Running without database..."));
});

// MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SIMPLE ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API ENDPOINTS
app.get('/api/stats', async (req, res) => {
    try {
        const { User, Group, Settings } = require('./database/models');
        const users = await User.countDocuments();
        const groups = await Group.countDocuments();
        const settings = await Settings.findOne();
        
        res.json({
            success: true,
            users,
            groups,
            settings: settings || {},
            uptime: process.uptime(),
            version: "2.1.1",
            botName: "INSIDIOUS",
            sessions: await countActiveSessions(),
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: "Database not available", 
            stats: { users: 0, groups: 0 },
            uptime: process.uptime(),
            serverTime: new Date().toISOString()
        });
    }
});

// Count active sessions
async function countActiveSessions() {
    try {
        const sessionDir = 'insidious_session';
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            return files.filter(f => f.endsWith('.json')).length;
        }
        return 0;
    } catch {
        return 0;
    }
}

let globalConn = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;

// BOT CONNECTION MANAGER
class BotConnection {
    constructor() {
        this.conn = null;
        this.isConnecting = false;
        this.sessionDir = 'insidious_session';
        this.ensureSessionDir();
    }

    ensureSessionDir() {
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
    }

    async connect() {
        if (this.isConnecting) return;
        
        this.isConnecting = true;
        console.log(fancy("🔌 Starting bot connection..."));
        
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

            const conn = makeWASocket({
                auth: { 
                    creds: state.creds, 
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
                },
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Safari"),
                syncFullHistory: false,
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                emitOwnEvents: true
            });

            this.conn = conn;
            globalConn = conn;

            // CONNECTION HANDLER WITH AUTO-RECONNECT
            conn.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'open') {
                    console.log(fancy("👹 INSIDIOUS V2.1.1 ACTIVATED"));
                    console.log(fancy("✅ Bot is now online"));
                    isConnected = true;
                    reconnectAttempts = 0;
                    this.isConnecting = false;
                    
                    // Save session info
                    try {
                        const { User } = require('./database/models');
                        const botUser = await User.findOne({ jid: conn.user.id });
                        if (!botUser) {
                            await new User({
                                jid: conn.user.id,
                                name: conn.user.name || "Insidious Bot",
                                deviceId: conn.user.id.split(':')[0],
                                isActive: true,
                                linkedAt: new Date(),
                                lastActive: new Date()
                            }).save();
                        } else {
                            botUser.isActive = true;
                            botUser.lastActive = new Date();
                            await botUser.save();
                        }
                        
                        console.log(fancy(`📱 Session saved for: ${conn.user.id.split(':')[0]}`));
                    } catch (e) {
                        console.log("Session save error:", e.message);
                    }
                    
                    // Connection message to owner
                    try {
                        const config = require('./config');
                        const connectionMsg = `
╭─── • 🥀 • ───╮
   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
👤 User: ${conn.user?.name || "Insidious"}
🆔 ID: ${conn.user?.id?.split(':')[0] || "Unknown"}
🕐 Time: ${new Date().toLocaleTimeString()}
📱 Server: ${os.hostname()}
🔄 Restarts: ${reconnectAttempts}

⚙️ *Features Ready:*
🤖 AI Chatbot: ✅
👁️ Anti-Viewonce: ✅
🗑️ Anti-Delete: ✅
📱 Auto Recording: ✅
💕 All Anti Features: ✅

Ready with love & feelings... ❤️`;
                        
                        // Send to bot owner
                        if (config.ownerNumber && config.ownerNumber.length > 0) {
                            const ownerJid = config.ownerNumber[0] + '@s.whatsapp.net';
                            await conn.sendMessage(ownerJid, { text: connectionMsg });
                        }
                        
                    } catch (e) {
                        console.log("Connection message error:", e.message);
                    }
                    
                    // INITIALIZE HANDLER
                    try {
                        const handler = require('./handler');
                        if (handler.init) {
                            await handler.init(conn);
                        }
                    } catch (e) {
                        console.error("Handler init error:", e.message);
                    }
                }
                
                if (connection === 'close') {
                    isConnected = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    console.log(fancy(`🔌 Connection closed | Code: ${statusCode || 'unknown'}`));
                    
                    if (shouldReconnect) {
                        reconnectAttempts++;
                        if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                            const delayTime = Math.min(1000 * reconnectAttempts, 30000); // Max 30 seconds
                            console.log(fancy(`🔄 Reconnecting in ${delayTime/1000}s... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
                            
                            setTimeout(async () => {
                                await this.connect();
                            }, delayTime);
                        } else {
                            console.log(fancy("❌ Max reconnection attempts reached. Please restart server."));
                        }
                    } else {
                        console.log(fancy("❌ Logged out. Please re-pair the bot."));
                    }
                    
                    this.isConnecting = false;
                }
                
                // Handle QR for new pairing
                if (update.qr) {
                    console.log(fancy("📱 QR Code available for pairing"));
                    // You can save QR to file or send to API if needed
                }
            });

            // CREDENTIALS UPDATE
            conn.ev.on('creds.update', saveCreds);

            // MESSAGE HANDLER
            conn.ev.on('messages.upsert', async (m) => {
                const msg = m.messages[0];
                if (!msg.message) return;

                try {
                    require('./handler')(conn, m);
                } catch (e) {
                    console.error("Handler error:", e.message);
                }
            });

            // GROUP UPDATES
            conn.ev.on('group-participants.update', async (update) => {
                try {
                    const handler = require('./handler');
                    if (handler.handleGroupUpdate) {
                        await handler.handleGroupUpdate(conn, update);
                    }
                } catch (e) {
                    console.error("Group update error:", e.message);
                }
            });

            console.log(fancy("🚀 INSIDIOUS ready for pairing (8-digit code)"));
            
        } catch (error) {
            console.error("Connection error:", error.message);
            this.isConnecting = false;
            
            // Auto retry on error
            reconnectAttempts++;
            if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                const delayTime = Math.min(5000 * reconnectAttempts, 60000);
                console.log(fancy(`🔄 Retrying in ${delayTime/1000}s... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
                
                setTimeout(async () => {
                    await this.connect();
                }, delayTime);
            }
        }
    }

    // Force reconnect
    async reconnect() {
        if (this.conn) {
            try {
                await this.conn.logout();
            } catch (e) {}
        }
        await this.connect();
    }
}

// Create bot instance
const bot = new BotConnection();

// PAIRING ENDPOINT - ALLOWS MULTIPLE PAIRING
app.get('/pair', async (req, res) => {
    try {
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
                error: "Invalid number format. Use: 255123456789" 
            });
        }
        
        console.log(fancy(`🔑 Generating pairing code for: ${cleanNum}`));
        
        if (!globalConn) {
            return res.json({ 
                success: false, 
                error: "Bot not connected yet. Please wait..." 
            });
        }
        
        try {
            const code = await globalConn.requestPairingCode(cleanNum);
            res.json({ 
                success: true, 
                code: code,
                message: `8-digit pairing code: ${code}`,
                instructions: "Open WhatsApp → Settings → Linked Devices → Link a Device → Enter this 8-digit code",
                validFor: "This code is valid for 30 seconds",
                note: "Multiple devices can be paired with the same number"
            });
            
        } catch (err) {
            if (err.message.includes("already paired") || err.message.includes("duplicate")) {
                res.json({ 
                    success: true, 
                    message: "Number already paired with bot",
                    alreadyPaired: true,
                    note: "You can still use the bot on multiple devices"
                });
            } else {
                throw err;
            }
        }
        
    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ 
            success: false, 
            error: "Failed to generate pairing code",
            details: err.message,
            solution: "Make sure bot is connected and try again"
        });
    }
});

// RESTART ENDPOINT
app.get('/restart', async (req, res) => {
    try {
        console.log(fancy("🔄 Manual restart requested"));
        await bot.reconnect();
        res.json({ 
            success: true, 
            message: "Bot restart initiated",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// STATUS ENDPOINT
app.get('/status', async (req, res) => {
    try {
        const { User } = require('./database/models');
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        
        res.json({
            success: true,
            bot: {
                connected: isConnected,
                ownerId: globalConn?.user?.id?.split(':')[0] || "Not connected",
                name: globalConn?.user?.name || "Insidious",
                uptime: process.uptime(),
                reconnectAttempts,
                sessionCount: await countActiveSessions()
            },
            stats: {
                totalUsers,
                activeUsers,
                sessions: await countActiveSessions()
            },
            server: {
                time: new Date().toISOString(),
                hostname: os.hostname(),
                platform: os.platform(),
                uptime: os.uptime(),
                memory: {
                    total: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
                    free: Math.round(os.freemem() / 1024 / 1024) + 'MB'
                }
            }
        });
    } catch (error) {
        res.json({
            success: false,
            bot: {
                connected: isConnected,
                uptime: process.uptime()
            },
            error: error.message
        });
    }
});

// HEALTH CHECK ENDPOINT (For Render/Railway)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connected: isConnected
    });
});

// START BOT CONNECTION
async function startBot() {
    console.log(fancy("🚀 Starting INSIDIOUS V2.1.1..."));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Year: 2025 | Updated: 2026"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
    
    // Wait a bit for MongoDB
    await delay(2000);
    
    // Start bot connection
    await bot.connect();
}

// START SERVER
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`📊 Status: http://localhost:${PORT}/status`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    
    // Start bot after server starts
    setTimeout(() => {
        startBot().catch(console.error);
    }, 1000);
});

// AUTO-RECONNECT ON CRASH
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    setTimeout(() => {
        console.log('🔄 Attempting auto-recovery...');
        startBot().catch(console.error);
    }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// KEEP-ALIVE FOR RENDER/RAILWAY
function setupKeepAlive() {
    // Self ping every 5 minutes
    setInterval(() => {
        const http = require('http');
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/health',
            method: 'GET',
            timeout: 10000
        };
        
        const req = http.request(options, (res) => {
            if (res.statusCode === 200) {
                console.log(fancy(`❤️ Keep-alive ping successful at ${new Date().toLocaleTimeString()}`));
            }
        });
        
        req.on('error', (err) => {
            console.log('Keep-alive ping failed:', err.message);
        });
        
        req.end();
    }, 5 * 60 * 1000); // 5 minutes
    
    // Auto-reconnect if disconnected for too long
    setInterval(() => {
        if (!isConnected && !bot.isConnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            console.log(fancy('🔌 Connection lost, attempting auto-reconnect...'));
            bot.connect().catch(console.error);
        }
    }, 30000); // Check every 30 seconds
}

// Start keep-alive after 10 seconds
setTimeout(setupKeepAlive, 10000);

// Helper function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    app,
    bot,
    getConnection: () => globalConn
};
