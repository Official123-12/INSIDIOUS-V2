const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs').promises;
const crypto = require('crypto');

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

// ==================== MONGODB (OPTIONAL) ====================
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch(err => console.log(fancy("❌ MongoDB Connection FAILED: " + err.message)));

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
try { require('fs').mkdirSync(path.join(__dirname, 'public'), { recursive: true }); } catch {}

// ==================== GLOBAL VARS ====================
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// ==================== LOAD CONFIG ====================
let config = {};
try { config = require('./config'); } catch {
    config = { prefix: '.', ownerNumber: ['255000000000'], botName: 'INSIDIOUS', workMode: 'public' };
}

// ==================== LOAD HANDLER ====================
let handler = {};
try { handler = require('./handler'); } catch {}

// ==================== MAIN BOT – NO AUTO-RECONNECT ====================
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
            // ========== NO AUTO-RECONNECT ==========
            maxRetryCount: 0,
            retryRequestDelayMs: 500,
            shouldIgnoreJid: () => true
        });

        globalConn = conn;
        botStartTime = Date.now();

        conn.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            // Only handle 'open' – do nothing on 'close'
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
                
                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                console.log(fancy(`🆔 Bot ID: ${botId}`));
                
                // Initialize handler
                setTimeout(async () => {
                    try {
                        if (handler && typeof handler.init === 'function') {
                            await handler.init(conn);
                        }
                    } catch (e) {
                        console.error(fancy("❌ Handler init error:"), e.message);
                    }
                }, 2000);
            }
            // NO HANDLING FOR 'close' – completely silent
        });

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', async (m) => {
            try { if (handler) await handler(conn, m); } catch {}
        });
        conn.ev.on('group-participants.update', async (up) => {
            try { if (handler?.handleGroupUpdate) await handler.handleGroupUpdate(conn, up); } catch {}
        });

        console.log(fancy("🚀 Main bot ready – no auto-reconnect, no close handling"));
    } catch (error) {
        console.error("Start error:", error.message);
        // No restart
    }
}
startBot();

// ==================== INDEPENDENT PAIRING ====================
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
            browser: Browsers.macOS("StanyTz"),
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
                    await new Promise(r => setTimeout(r, 1000));
                    try {
                        const code = await conn.requestPairingCode(number);
                        clearTimeout(timeout);
                        resolve(code);
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

// ==================== PAIRING ENDPOINT ====================
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ error: "Provide number! Example: /pair?num=255123456789" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) return res.json({ error: "Invalid number" });

        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));
        const code = await requestPairingCode(cleanNum);

        if (handler && handler.pairNumber) {
            await handler.pairNumber(cleanNum).catch(() => {});
        }

        res.json({
            success: true,
            code: code,
            formattedCode: code.match(/.{1,4}/g)?.join('-') || code,
            message: `✅ 8-digit pairing code: ${code}`
        });
    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ success: false, error: err.message });
    }
});

// ==================== UNPAIR ====================
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ error: "Provide number" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) return res.json({ error: "Invalid number" });

        if (handler && handler.unpairNumber) {
            const ok = await handler.unpairNumber(cleanNum);
            res.json({ success: ok, message: ok ? `✅ Number ${cleanNum} unpaired` : "❌ Number not paired" });
        } else {
            res.json({ success: true, message: `✅ Number ${cleanNum} unpaired (simulated)` });
        }
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ==================== PAIRED LIST ====================
app.get('/paired', (req, res) => {
    try {
        let deployer = config.ownerNumber || [];
        let coOwners = [];
        let botId = handler?.getBotId ? handler.getBotId() : null;
        if (handler?.getPairedNumbers) {
            const all = handler.getPairedNumbers();
            coOwners = all.filter(n => !deployer.includes(n));
        }
        res.json({ botId, deployer, coOwners, count: coOwners.length, max: config.maxCoOwners || 2 });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ==================== HEALTH & INFO ====================
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    res.json({
        status: 'healthy',
        connected: isConnected,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.get('/botinfo', (req, res) => {
    if (!globalConn || !globalConn.user) {
        return res.json({ error: "Bot not connected" });
    }
    res.json({
        botName: globalConn.user?.name || "INSIDIOUS",
        botNumber: globalConn.user?.id?.split(':')[0] || "Unknown",
        botId: globalConn.user?.id || "Unknown",
        connected: isConnected,
        uptime: Date.now() - botStartTime
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pair (8‑digit): http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`📋 Paired list: http://localhost:${PORT}/paired`));
    console.log(fancy(`✅ Multi‑user pairing: ENABLED`));
    console.log(fancy(`🤖 Main bot: auto-reconnect DISABLED, no handling of connection close.`));
});

module.exports = app;