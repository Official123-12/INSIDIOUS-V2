const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs-extra');
const crypto = require('crypto');

// ==================== LOAD HANDLER & CONFIG ====================
const handler = require('./handler');
let config = {};
try { config = require('./config'); } catch { config = {}; }

// ==================== FANCY FUNCTION ====================
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

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all interfaces

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== GLOBAL VARS ====================
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();
const activeSessions = new Map();

// ==================== UNHANDLED REJECTION GUARD ====================
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==================== MONGODB CONNECTION (NON-BLOCKING) ====================
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

// Connect without awaiting – let it run in background
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch(err => {
    console.log(fancy("❌ MongoDB Connection FAILED: " + err.message));
    console.log(fancy("⚠️ Continuing without MongoDB – sessions will be file-based"));
});

// ==================== MAIN BOT – STARTS FOR OWNER ====================
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS..."));
        const { state, saveCreds } = await useMultiFileAuthState('insidious_session');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            maxRetryCount: 0,  // no auto‑reconnect (manual)
            retryRequestDelayMs: 500,
            shouldIgnoreJid: () => true
        });

        globalConn = conn;
        botStartTime = Date.now();

        conn.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(fancy("✅ Bot online"));
                isConnected = true;
                if (handler && handler.init) await handler.init(conn).catch(() => {});
            }
            // No handling of 'close' – bot stays offline if disconnected
        });

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', async (m) => {
            try { if (handler) await handler(conn, m); } catch {}
        });
        conn.ev.on('group-participants.update', async (up) => {
            try { if (handler?.handleGroupUpdate) await handler.handleGroupUpdate(conn, up); } catch {}
        });
        conn.ev.on('call', async (call) => {
            try { if (handler?.handleCall) await handler.handleCall(conn, call); } catch {}
        });

        console.log(fancy("🚀 Main bot ready"));
    } catch (error) {
        console.error("Start error:", error.message);
    }
}
// Start the main bot in background – errors are caught
startBot().catch(err => console.error("Main bot start failed:", err));

// ==================== TEMPORARY PAIRING SOCKET ====================
async function requestPairingCode(number) {
    const sessionId = crypto.randomBytes(8).toString('hex');
    const sessionDir = path.join(__dirname, `temp_pair_${sessionId}`);

    try {
        const { state } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: false,
            shouldIgnoreJid: () => true,
            maxRetryCount: 2,
            retryRequestDelayMs: 1000
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                conn.end();
                reject(new Error("⏰ Pairing timeout (60s)"));
            }, 60000);

            conn.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'open') {
                    await new Promise(r => setTimeout(r, 1000)); // ensure socket ready
                    try {
                        const code = await conn.requestPairingCode(number);
                        clearTimeout(timeout);
                        resolve({ code, conn });
                    } catch (err) {
                        reject(err);
                    } finally {
                        setTimeout(() => conn.end(), 2000);
                        setTimeout(async () => {
                            try { await fs.rm(sessionDir, { recursive: true, force: true }); } catch {}
                        }, 3000);
                    }
                }
                if (connection === 'close' && !update.isOnline) {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === 429) reject(new Error("🚫 Rate limited. Wait 5 minutes."));
                    else reject(new Error("❌ Connection closed. Please try again."));
                }
            });
        });
    } catch (err) {
        setTimeout(async () => {
            try { await fs.rm(sessionDir, { recursive: true, force: true }); } catch {}
        }, 1000);
        throw err;
    }
}

// ==================== EXPRESS ROUTES ====================

// Quick root route (optional)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// FAST Health Check – must respond immediately
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    res.json({
        status: 'healthy',
        uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`,
        connected: isConnected,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        activeSessions: activeSessions.size
    });
});

// Bot Info
app.get('/botinfo', (req, res) => {
    if (!globalConn || !globalConn.user) {
        return res.json({ success: false, error: "Main bot not connected" });
    }
    res.json({
        success: true,
        botName: globalConn.user?.name || "INSIDIOUS",
        botNumber: globalConn.user?.id?.split(':')[0] || "Unknown",
        botJid: globalConn.user?.id || "Unknown",
        connected: isConnected,
        uptime: Date.now() - botStartTime,
        activeSessions: activeSessions.size
    });
});

// List sessions (placeholder)
app.get('/sessions', (req, res) => {
    const sessions = [];
    if (globalConn && globalConn.user) {
        sessions.push({
            sessionId: 'main',
            phoneNumber: globalConn.user?.id?.split(':')[0] || 'Unknown',
            status: isConnected ? 'active' : 'disconnected',
            connected: isConnected,
            createdAt: new Date(botStartTime).toISOString(),
            lastActive: new Date().toISOString()
        });
    }
    res.json({ success: true, sessions, count: sessions.length });
});

// Pair endpoint – returns code AND sessionId (phone number)
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.status(400).json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) return res.status(400).json({ success: false, error: "Invalid number" });

        console.log(fancy(`🔑 Generating code for: ${cleanNum}`));
        const { code } = await requestPairingCode(cleanNum);

        // Register as co‑owner in handler
        if (handler && handler.pairNumber) {
            await handler.pairNumber(cleanNum).catch(() => {});
        }

        res.json({
            success: true,
            code: code,
            formattedCode: code.match(/.{1,4}/g)?.join('-') || code,
            sessionId: cleanNum,
            message: `✅ 8-digit pairing code: ${code}`
        });
    } catch (err) {
        console.error("Pairing error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete session (placeholder)
app.delete('/sessions/:sessionId', (req, res) => {
    res.status(200).json({ success: false, error: "Not implemented in this version" });
});

// Update settings (placeholder)
app.post('/settings', (req, res) => {
    res.status(200).json({ success: false, error: "Use WhatsApp command .settings" });
});

// Catch-all 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ==================== START SERVER ====================
const server = app.listen(PORT, HOST, () => {
    console.log(fancy(`🌐 Web: http://${HOST}:${PORT}`));
    console.log(fancy(`🔗 Pair (8‑digit): http://${HOST}:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`📋 Sessions: http://${HOST}:${PORT}/sessions`));
    console.log(fancy(`❤️ Health: http://${HOST}:${PORT}/health`));
    console.log(fancy(`✅ Multi‑user pairing: ENABLED`));
    console.log(fancy(`🤖 Main bot: auto‑reconnect DISABLED`));
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', async () => {
    console.log(fancy("🛑 Shutting down..."));
    if (globalConn) await globalConn.end();
    server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
    console.log(fancy("🛑 Shutting down..."));
    if (globalConn) await globalConn.end();
    server.close(() => process.exit(0));
});

// ==================== EXPORTS ====================
module.exports = { app, server, connections: activeSessions };