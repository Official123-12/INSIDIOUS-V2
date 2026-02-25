const express = require('express');
const { default: makeWASocket, Browsers, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

const handler = require('./handler');
const useMongoAuthState = require('./mongoAuthState');
const Session = require('./models/Session');

// ==================== UTILITY FUNCTIONS ====================
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
    return text.split('').map(c => map[c] || c).join('');
}

function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

// ==================== EXPRESS SETUP ====================
const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";
const mongooseOptions = {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 90000,
    connectTimeoutMS: 60000,
    maxPoolSize: 20,
    minPoolSize: 5,
    retryWrites: true,
    retryReads: true
};

let isMongoConnected = false;

// ==================== MONGODB CONNECTION ====================
async function connectToMongo() {
    try {
        await mongoose.connect(MONGODB_URI, mongooseOptions);
        console.log(fancy("✅ MongoDB Connected (Sila)"));
        isMongoConnected = true;
        await cleanupInvalidSessions();
        await startAllActiveSessions();
    } catch (err) {
        console.log(fancy("❌ MongoDB Connection FAILED"), err.message);
        isMongoConnected = false;
        setTimeout(connectToMongo, 30000);
    }
}

async function startServer() {
    connectToMongo();
    app.listen(PORT, () => {
        console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
        console.log(fancy(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
        console.log(fancy(`🚀 Deploy: POST http://localhost:${PORT}/deploy`));
        console.log(fancy(`📋 Sessions: http://localhost:${PORT}/sessions`));
        console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
        console.log(fancy("👑 Developer: STANYTZ"));
        console.log(fancy("📅 Version: 3.0.0 | Year: 2025"));
    });
}

async function waitForMongoConnection(timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (mongoose.connection.readyState === 1) return true;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
}

// ==================== MIDDLEWARE & STATIC FILES ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// ==================== GLOBAL STATE ====================
const activeSockets = new Map();
let botStartTime = Date.now();

let config = {};
try { 
    config = require('./config'); 
    console.log(fancy("📋 Config loaded")); 
} catch { 
    config = { 
        prefix: '.', 
        ownerNumber: ['255000000000'], 
        botName: 'INSIDIOUS', 
        workMode: 'public', 
        botImage: 'https://files.catbox.moe/f3c07u.jpg' 
    }; 
}

// ==================== SESSION MANAGEMENT ====================
async function cleanupInvalidSessions() {
    try {
        const result = await Session.deleteMany({ 
            $or: [
                { creds: { $exists: false } }, 
                { creds: null }, 
                { "creds.me": { $exists: false } },
                { "creds.me.id": { $exists: false } }
            ] 
        });
        console.log(fancy(`🧹 Cleaned up ${result.deletedCount} invalid sessions`));
        await Session.updateMany({ status: 'active' }, { status: 'inactive' });
        console.log(fancy(`📝 Reset all sessions to inactive`));
    } catch (error) { 
        console.error("Error cleaning sessions:", error.message); 
    }
}

async function startUserBot(sessionId, phoneNumber) {
    if (activeSockets.has(sessionId)) {
        console.log(fancy(`⚠️ Session ${sessionId} already running`));
        return;
    }
    
    try {
        const { state, saveCreds } = await useMongoAuthState(sessionId);
        
        if (!state.creds || !state.creds.me || !state.creds.me.id) {
            console.log(fancy(`⚠️ Session ${sessionId} has invalid credentials. Marking as expired.`));
            await Session.updateOne({ sessionId }, { status: 'expired' }); 
            return;
        }
        
        // Use manual WhatsApp version to avoid fetchLatestBaileysVersion issues
        const version = [2, 3000, 1028442591];
        
        const conn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: state.keys },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            shouldSyncHistoryMessage: () => false,
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 2500 }
        });
        
        activeSockets.set(sessionId, conn);
        
        // Save creds on update
        conn.ev.on('creds.update', async () => {
            try {
                await saveCreds();
            } catch (err) {
                console.error(`[Session ${sessionId}] Error saving creds:`, err.message);
            }
        });
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(fancy(`📱 Session ${sessionId}: QR code ready`));
            }
            
            if (connection === 'open') { 
                console.log(fancy(`✅ Session ${sessionId} (${phoneNumber}) connected`)); 
                await Session.updateOne({ sessionId }, { status: 'active', lastConnected: new Date() }); 
            }
            
            if (connection === 'close') {
                console.log(fancy(`🔌 Session ${sessionId} connection closed`));
                activeSockets.delete(sessionId);
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut 
                    && statusCode !== DisconnectReason.badSession
                    && statusCode !== DisconnectReason.connectionClosed
                    && statusCode !== DisconnectReason.connectionLost;
                
                if (shouldReconnect) { 
                    console.log(fancy(`🔄 Reconnecting session ${sessionId} in 5s...`)); 
                    setTimeout(() => startUserBot(sessionId, phoneNumber), 5000); 
                } else { 
                    console.log(fancy(`🚫 Session ${sessionId} logged out or invalid. Status:`, statusCode)); 
                    await Session.updateOne({ sessionId }, { status: 'expired', lastDisconnected: new Date() }); 
                }
            }
        });
        
        // Message handler
        conn.ev.on('messages.upsert', async (m) => { 
            try { 
                if (handler && typeof handler === 'function') {
                    await handler(conn, m, config); 
                }
            } catch (error) { 
                console.error(`Message handler error for ${sessionId}:`, error.message); 
            } 
        });
        
        // Group updates
        conn.ev.on('group-participants.update', async (update) => { 
            try { 
                if (handler && handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update, config); 
                }
            } catch (error) { 
                console.error(`Group update error for ${sessionId}:`, error.message); 
            } 
        });
        
        // Call handler
        conn.ev.on('call', async (call) => { 
            try { 
                if (handler && handler.handleCall) {
                    await handler.handleCall(conn, call, config); 
                }
            } catch (error) { 
                console.error(`Call handler error for ${sessionId}:`, error.message); 
            } 
        });
        
        console.log(fancy(`🚀 User bot started for session ${sessionId} (${phoneNumber})`));
        
    } catch (error) { 
        console.error(`Error starting user bot ${sessionId}:`, error.message); 
        await Session.updateOne({ sessionId }, { status: 'expired' }); 
    }
}

async function startAllActiveSessions() {
    try {
        const activeSessions = await Session.find({ status: 'active' });
        console.log(fancy(`📦 Found ${activeSessions.length} active sessions to start`));
        
        for (const session of activeSessions) {
            if (!session.creds || !session.creds.me || !session.creds.me.id) { 
                console.log(fancy(`⚠️ Session ${session.sessionId} has invalid creds, marking expired`)); 
                await Session.updateOne({ _id: session._id }, { status: 'expired' }); 
                continue; 
            }
            setTimeout(() => {
                startUserBot(session.sessionId, session.phoneNumber);
            }, 1000);
        }
    } catch (error) { 
        console.error(fancy("❌ Error loading active sessions:"), error.message); 
    }
}

// ==================== PAIR ENDPOINT (FIXED) ====================
app.get('/pair', async (req, res) => {
    if (!await waitForMongoConnection()) {
        return res.json({ success: false, error: "MongoDB not connected. Please try again." });
    }
    
    try {
        let num = req.query.num;
        if (!num) return res.json({ success: false, error: "Provide number!" });
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10 || cleanNum.length > 15) {
            return res.json({ success: false, error: "Invalid number format." });
        }

        const sessionId = randomMegaId(6, 4);
        console.log(`[PAIR] Starting pairing for ${cleanNum} with session ${sessionId}`);

        const { state, saveCreds } = await useMongoAuthState(sessionId);
        
        // Use manual WhatsApp version instead of fetchLatestBaileysVersion()
        const version = [2, 3000, 1028442591];
        
        const tempConn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: state.keys },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000
        });

        // CRITICAL FIX: Wait 5 seconds before requesting pairing code
        console.log(`[PAIR] Waiting 5 seconds for connection to initialize...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        let pairingCode;
        try {
            pairingCode = await tempConn.requestPairingCode(cleanNum);
            console.log(`[PAIR] Pairing code generated: ${pairingCode}`);
        } catch (err) {
            tempConn.end();
            console.error(`[PAIR] Failed to generate code:`, err.message);
            return res.json({ success: false, error: "Failed to generate pairing code: " + err.message });
        }

        // Wait for connection OR creds update
        const connectionPromise = new Promise((resolve, reject) => {
            let resolved = false;
            
            const onConnection = (update) => {
                if (resolved) return;
                console.log(`[PAIR] Connection update:`, update.connection);
                if (update.connection === 'open') {
                    resolved = true;
                    resolve('connected');
                } else if (update.connection === 'close') {
                    resolved = true;
                    reject(new Error('Connection closed during pairing'));
                }
            };
            
            const onCredsUpdate = async () => {
                if (resolved) return;
                const creds = tempConn.authState?.creds;
                if (creds?.me?.id) {
                    console.log(`[PAIR] Valid creds received via creds.update`);
                    resolved = true;
                    tempConn.ev.off('connection.update', onConnection);
                    resolve('creds_ready');
                }
            };
            
            tempConn.ev.on('connection.update', onConnection);
            tempConn.ev.on('creds.update', onCredsUpdate);
            
            return () => {
                tempConn.ev.off('connection.update', onConnection);
                tempConn.ev.off('creds.update', onCredsUpdate);
            };
        });

        let result;
        try {
            result = await Promise.race([
                connectionPromise, 
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Pairing timeout (120s)')), 120000)
                )
            ]);
            console.log(`[PAIR] Pairing completed: ${result}`);
        } catch (timeoutErr) {
            tempConn.end();
            return res.json({ success: false, error: "Pairing timed out. Please try again." });
        }

        // Verify credentials with retry
        let finalCreds = null;
        let credsVerified = false;
        
        for (let attempt = 0; attempt < 5; attempt++) {
            await new Promise(r => setTimeout(r, 2000));
            
            if (tempConn.authState?.creds?.me?.id) {
                finalCreds = tempConn.authState.creds;
                credsVerified = true;
                console.log(`[PAIR] Creds verified in memory (attempt ${attempt + 1})`);
                break;
            }
            
            const dbSession = await Session.findOne({ sessionId });
            if (dbSession?.creds?.me?.id) {
                finalCreds = dbSession.creds;
                credsVerified = true;
                console.log(`[PAIR] Creds verified from database (attempt ${attempt + 1})`);
                break;
            }
        }
        
        if (!credsVerified || !finalCreds?.me?.id) {
            tempConn.end();
            return res.json({ success: false, error: "Credentials verification failed. Please try pairing again." });
        }

        await saveCreds();
        console.log(`[PAIR] Credentials saved successfully`);

        const savedSession = await Session.findOneAndUpdate(
            { sessionId },
            { 
                status: 'inactive',
                phoneNumber: cleanNum,
                lastPaired: new Date(),
                creds: finalCreds
            },
            { new: true, upsert: true }
        );

        if (!savedSession?.creds?.me?.id) {
            return res.json({ success: false, error: "Failed to save session. Please try again." });
        }

        // Send welcome message
        const welcomeMessage = `╭─── • 🥀 • ───╮\n   INSIDIOUS: PAIRING SUCCESS\n╰─── • 🥀 • ───╯\n\n✅ *Your WhatsApp has been linked!*\n🆔 *Your Session ID:* ${sessionId}\n\n📌 *Next Steps:*\n1. Copy your Session ID above.\n2. Go to our website: ${req.protocol}://${req.get('host')}\n3. Enter your phone number and Session ID in the Deploy section.\n4. Your bot will start immediately.\n\n⚡ *Bot will be active after deployment.*\n👑 *Developer:* STANYTZ`;
        
        try {
            await tempConn.sendMessage(cleanNum + '@s.whatsapp.net', { text: welcomeMessage });
            await new Promise(r => setTimeout(r, 1000));
            await tempConn.sendMessage(cleanNum + '@s.whatsapp.net', { text: `🔑 *Session ID:*\n\`${sessionId}\`` });
            console.log(`[PAIR] Welcome messages sent to ${cleanNum}`);
        } catch (msgErr) {
            console.warn(`[PAIR] Could not send welcome message:`, msgErr.message);
        }

        tempConn.end();
        console.log(`[PAIR] Temporary connection closed for ${sessionId}`);

        res.json({ 
            success: true, 
            code: pairingCode, 
            sessionId: sessionId, 
            message: "Pairing successful! Check your WhatsApp for your Session ID." 
        });
        
    } catch (err) {
        console.error("Pairing error:", err);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ==================== DEPLOY ENDPOINT ====================
app.post('/deploy', async (req, res) => {
    if (!await waitForMongoConnection()) {
        return res.json({ success: false, error: "MongoDB not connected. Please try again." });
    }
    
    try {
        const { sessionId, number } = req.body;
        
        if (!sessionId || !number) {
            return res.json({ success: false, error: "Missing sessionId or number" });
        }
        
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({ sessionId });
        
        if (!session) {
            return res.json({ success: false, error: "Session not found" });
        }
        
        if (!session.creds || !session.creds.me || !session.creds.me.id) {
            return res.json({ success: false, error: "Session credentials are invalid. Please pair again." });
        }
        
        session.status = 'active'; 
        session.phoneNumber = cleanNumber; 
        session.lastDeployed = new Date();
        await session.save();
        
        if (!activeSockets.has(sessionId)) {
            console.log(fancy(`🚀 Deploying bot for session ${sessionId}`));
            startUserBot(sessionId, cleanNumber);
        } else {
            console.log(fancy(`🔄 Session ${sessionId} already running, refreshing...`));
        }
        
        res.json({ success: true, message: "Bot deployed successfully", sessionId });
        
    } catch (err) { 
        console.error("Deploy error:", err.message); 
        res.json({ success: false, error: "Failed: " + err.message }); 
    }
});

// ==================== SESSIONS ENDPOINTS ====================
app.get('/sessions', async (req, res) => {
    if (!await waitForMongoConnection()) {
        return res.json({ success: false, error: "MongoDB not connected" });
    }
    
    try { 
        const sessions = await Session.find(
            {}, 
            { sessionId: 1, phoneNumber: 1, status: 1, lastPaired: 1, lastConnected: 1, _id: 0 }
        ).sort({ lastPaired: -1 });
        
        res.json({ 
            success: true, 
            sessions,
            activeCount: sessions.filter(s => s.status === 'active').length 
        }); 
    } catch (err) { 
        console.error("Sessions fetch error:", err.message); 
        res.json({ success: false, error: err.message }); 
    }
});

app.delete('/sessions/:sessionId', async (req, res) => {
    if (!await waitForMongoConnection()) {
        return res.json({ success: false, error: "MongoDB not connected" });
    }
    
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        
        if (!session) {
            return res.json({ success: false, error: "Session not found" });
        }
        
        const sock = activeSockets.get(sessionId);
        if (sock) { 
            try {
                await sock.logout(); 
            } catch (err) {
                console.warn(`Error logging out session ${sessionId}:`, err.message);
            }
            sock.end(); 
            activeSockets.delete(sessionId); 
            console.log(fancy(`🗑️ Socket closed for ${sessionId}`));
        }
        
        await Session.deleteOne({ sessionId });
        console.log(fancy(`🗑️ Session ${sessionId} deleted from database`));
        
        res.json({ success: true, message: "Session deleted successfully" });
        
    } catch (err) { 
        console.error("Delete session error:", err.message); 
        res.json({ success: false, error: err.message }); 
    }
});

// ==================== UTILITY ENDPOINTS ====================
app.get('/health', (req, res) => {
    const uptime = process.uptime(); 
    const hours = Math.floor(uptime / 3600); 
    const minutes = Math.floor((uptime % 3600) / 60); 
    const seconds = Math.floor(uptime % 60);
    
    res.json({ 
        status: 'healthy', 
        connectedSessions: activeSockets.size, 
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        uptime: `${hours}h ${minutes}m ${seconds}s` 
    });
});

app.get('/botinfo', (req, res) => { 
    res.json({ 
        success: true, 
        botName: config.botName || "INSIDIOUS", 
        activeSessions: activeSockets.size, 
        uptime: Date.now() - botStartTime,
        version: "3.0.0",
        developer: "STANYTZ"
    }); 
});

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (err) => { 
    console.error('❌ Unhandled Rejection:', err); 
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('SIGTERM', async () => {
    console.log(fancy('🛑 Received SIGTERM, shutting down gracefully...'));
    for (const [sessionId, sock] of activeSockets) {
        try {
            await sock.logout();
            sock.end();
        } catch (err) {
            console.error(`Error closing ${sessionId}:`, err.message);
        }
    }
    await mongoose.disconnect();
    process.exit(0);
});

// ==================== START SERVER ====================
startServer();

module.exports = app;

