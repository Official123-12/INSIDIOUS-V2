const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    DisconnectReason,
    BufferJSON,
    proto
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== CONFIG & HANDLER ====================
const handler = require('./handler');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== DATABASE SCHEMAS ====================

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String, required: true },
    creds: { type: Object, required: true },
    status: { type: String, default: 'paired', enum: ['paired', 'active', 'inactive'], index: true },
    addedAt: { type: Date, default: Date.now }
});
const Session = mongoose.model('UserSession', sessionSchema);

const authKeySchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    keyId: { type: String, required: true },
    data: { type: Object }
});
authKeySchema.index({ sessionId: 1, keyId: 1 }, { unique: true });
const AuthKey = mongoose.model('AuthKey', authKeySchema);

// ==================== MONGO AUTH STATE LOGIC ====================

const useMongoAuthState = async (sessionId) => {
    const writeData = async (data, keyId) => {
        try {
            await AuthKey.updateOne(
                { sessionId, keyId },
                { $set: { data: JSON.parse(JSON.stringify(data, BufferJSON.replacer)) } },
                { upsert: true }
            );
        } catch (e) { console.error('AuthKey Save Error:', e); }
    };

    const readData = async (keyId) => {
        try {
            const res = await AuthKey.findOne({ sessionId, keyId });
            return res ? JSON.parse(JSON.stringify(res.data), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };

    const removeData = async (keyId) => {
        try { await AuthKey.deleteOne({ sessionId, keyId }); } catch (e) { }
    };

    const sessionRecord = await Session.findOne({ sessionId });
    if (!sessionRecord) throw new Error("Session not found in DB");

    let creds = JSON.parse(JSON.stringify(sessionRecord.creds), BufferJSON.reviver);

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const keyId = `${category}-${id}`;
                            value ? await writeData(value, keyId) : await removeData(keyId);
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await Session.updateOne(
                { sessionId },
                { $set: { creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)) } }
            );
        }
    };
};

// ==================== UTILITIES ====================

function fancy(text) {
    const map = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
    return text.split('').map(c => map[c.toLowerCase()] || c).join('');
}

function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

// ==================== PAIRING ENGINE (SINGLE USER AT A TIME) ====================

let pairingSocket = null;
let engineReady = false;
let engineBusy = false; // Indicates if a pairing is in progress
let currentSessionId = null;

// Clean temp folder at start
function cleanTempFolder() {
    if (fs.existsSync('./pairing_temp')) fs.rmSync('./pairing_temp', { recursive: true, force: true });
}

async function startPairingEngine() {
    cleanTempFolder();

    const { state, saveCreds } = await useMultiFileAuthState('pairing_temp');

    const conn = makeWASocket({
        version: [2, 3000, 1033105955],
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false, 
        shouldSyncHistoryMessage: () => false, 
        getMessage: async (key) => ({ conversation: "Insidious Bot" }),
        connectTimeoutMs: 60000
    });

    pairingSocket = conn;
    engineReady = false;
    engineBusy = false;
    currentSessionId = null;

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            engineReady = true;
            console.log(fancy("✅ Pairing Engine Ready"));
        }

        if (connection === 'close') {
            engineReady = false;
            engineBusy = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log(fancy("🔄 Pairing Engine closed, restarting..."));
                startPairingEngine();
            } else {
                console.log(fancy("🚫 Pairing Engine logged out. Manual restart needed."));
            }
        }
    });

    conn.ev.on('error', (err) => {
        console.error('❌ Pairing engine error:', err);
        engineReady = false;
        engineBusy = false;
        // Attempt restart after a delay
        setTimeout(startPairingEngine, 5000);
    });
}

// ==================== HANDLE SUCCESSFUL LINK ====================

async function handleSuccessfulLink(conn, userJid, sessionId) {
    console.log(fancy(`✅ Link Successful for ${userJid}. Session ID: ${sessionId}`));

    // Retrieve creds from the socket's authState
    // We need to access the auth state. Unfortunately, the socket doesn't expose it directly.
    // But we can read from the pairing_temp folder because we used useMultiFileAuthState.
    // However, that folder contains the creds for this specific pairing. Since we're using a single engine,
    // these creds belong to the current user. We'll read the creds from the folder.
    let creds;
    try {
        const credsData = fs.readFileSync('./pairing_temp/creds.json', 'utf-8');
        creds = JSON.parse(credsData, BufferJSON.reviver);
    } catch (e) {
        console.error('❌ Failed to read creds from temp folder:', e);
        return;
    }

    // Save to MongoDB with status 'paired'
    await Session.findOneAndUpdate(
        { phoneNumber: userJid },
        { 
            sessionId, 
            phoneNumber: userJid, 
            creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)), 
            status: 'paired' 
        },
        { upsert: true }
    );

    // Send welcome messages
    try {
        const welcomeMsg = `╭─── • 🥀 • ───╮\n   INSIDIOUS BOT\n╰─── • 🥀 • ───╯\n\n✅ *Pairing Successful!*\n\n🆔 *SESSION ID:* \`${sessionId}\`\n\nCopy this ID, go to the website and paste it in the **Deploy** section to start your bot.`;

        await conn.sendMessage(userJid + '@s.whatsapp.net', { 
            image: { url: "https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg" },
            caption: welcomeMsg
        });
        await conn.sendMessage(userJid + '@s.whatsapp.net', { text: sessionId });
        console.log(`📨 Welcome messages sent to ${userJid}`);
    } catch (msgErr) {
        console.error('❌ Failed to send welcome messages:', msgErr);
    }

    // Now restart the engine for next user
    engineBusy = false;
    currentSessionId = null;
    // Close current socket and start fresh
    conn.ev.removeAllListeners();
    conn.terminate();
    cleanTempFolder();
    startPairingEngine(); // This will create a new socket with fresh creds
}

// ==================== API: PAIRING ====================

app.get('/pair', async (req, res) => {
    const num = req.query.num;
    if (!num || !/^[0-9]{10,15}$/.test(num)) {
        return res.status(400).json({ success: false, error: "Invalid number. Use format: 2557XXXXXXXX" });
    }

    if (!engineReady) {
        return res.status(503).json({ success: false, error: "Pairing engine is starting, please wait." });
    }

    if (engineBusy) {
        return res.status(429).json({ success: false, error: "Another pairing is in progress. Try again later." });
    }

    const sessionId = randomMegaId();
    console.log(`🔑 Pairing request for ${num} | Session: ${sessionId}`);

    engineBusy = true;
    currentSessionId = sessionId;

    try {
        const code = await pairingSocket.requestPairingCode(num);
        console.log(`📱 Pairing code for ${num}: ${code}`);

        // Send code immediately
        res.json({ success: true, code, sessionId });

        // Set up one-time listener for successful link
        const connectionHandler = async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                pairingSocket.ev.off('connection.update', connectionHandler);
                await handleSuccessfulLink(pairingSocket, num, sessionId);
            }
        };
        pairingSocket.ev.on('connection.update', connectionHandler);

        // Optional: timeout to release engine if user never scans
        setTimeout(() => {
            if (engineBusy && currentSessionId === sessionId) {
                console.log(`⏰ Pairing timeout for ${num}`);
                engineBusy = false;
                currentSessionId = null;
                // Restart engine to clear any half-open state
                pairingSocket.ev.removeAllListeners();
                pairingSocket.terminate();
                cleanTempFolder();
                startPairingEngine();
            }
        }, 90000);

    } catch (err) {
        console.error('❌ Pairing error:', err);
        engineBusy = false;
        currentSessionId = null;
        // Restart engine on error
        pairingSocket.ev.removeAllListeners();
        pairingSocket.terminate();
        cleanTempFolder();
        startPairingEngine();
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message || "Pairing failed." });
        }
    }
});

// ==================== DEPLOYMENT SYSTEM ====================

const activeBots = new Map();

async function activateBot(sessionId, phoneNumber) {
    if (activeBots.has(sessionId)) {
        try { activeBots.get(sessionId).terminate(); } catch (e) {}
        activeBots.delete(sessionId);
    }

    try {
        const { state, saveCreds } = await useMongoAuthState(sessionId);

        const conn = makeWASocket({
            version: [2, 3000, 1033105955],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        activeBots.set(sessionId, conn);
        await Session.updateOne({ sessionId }, { status: 'active' });

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(`🚀 Bot LIVE: ${sessionId} (${phoneNumber})`);
            }
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    console.log(`🔄 Reconnecting bot ${sessionId}...`);
                    setTimeout(() => activateBot(sessionId, phoneNumber), 5000);
                } else {
                    console.log(`🚫 Bot ${sessionId} logged out. Removing session.`);
                    await Session.deleteOne({ sessionId });
                    await AuthKey.deleteMany({ sessionId });
                    activeBots.delete(sessionId);
                }
            }
        });

        conn.ev.on('messages.upsert', async (m) => {
            try { await handler(conn, m); } catch (e) { console.error('Handler error:', e); }
        });

        return { success: true };
    } catch (err) {
        console.error(`❌ Failed to activate bot ${sessionId}:`, err);
        return { success: false, error: err.message };
    }
}

app.post('/deploy', async (req, res) => {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) {
        return res.status(400).json({ success: false, error: "Session ID and phone number required." });
    }

    const session = await Session.findOne({ sessionId, phoneNumber: number, status: 'paired' });
    if (!session) {
        return res.status(404).json({ success: false, error: "Session not found or already deployed." });
    }

    const result = await activateBot(sessionId, number);
    if (result.success) {
        res.json({ success: true, message: "Bot deployed successfully!" });
    } else {
        res.status(500).json({ success: false, error: result.error });
    }
});

// ==================== SESSIONS API ====================

app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({}, { creds: 0 }).sort({ addedAt: -1 });
        res.json({ success: true, sessions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/sessions/:id', async (req, res) => {
    const sessionId = req.params.id;
    try {
        await Session.deleteOne({ sessionId });
        await AuthKey.deleteMany({ sessionId });
        if (activeBots.has(sessionId)) {
            activeBots.get(sessionId).terminate();
            activeBots.delete(sessionId);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== SETTINGS (placeholder) ====================

app.post('/settings', (req, res) => res.json({ success: true }));

// ==================== HEALTH ====================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        activeBots: activeBots.size,
        engineReady,
        engineBusy,
        uptime: process.uptime()
    });
});

// ==================== STATIC ====================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== START ====================

const MONGODB_URI = process.env.MONGODB_URI; // Must be set in environment
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required!');
    process.exit(1);
}

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log(fancy("🟢 MongoDB Connected"));
        startPairingEngine();
        // Restore active bots
        const activeSessions = await Session.find({ status: 'active' });
        for (const sess of activeSessions) {
            activateBot(sess.sessionId, sess.phoneNumber).catch(err => console.error('Restore error:', err));
        }
        console.log(fancy("🚀 INSIDIOUS BOT Station Ready"));
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

module.exports = app;