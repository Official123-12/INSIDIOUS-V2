const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason,
    BufferJSON,
    proto
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs').promises; // Use promises for async file ops

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

// ==================== TEMPORARY PAIRING STORAGE (in-memory) ====================
// Used to store pairing data until the user scans the code
const tempPairings = new Map(); // key: sessionId, value: { phoneNumber, creds, expiry }

// Cleanup expired temp pairings every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of tempPairings.entries()) {
        if (now > data.expiry) {
            tempPairings.delete(id);
            // Also remove temp folder if any (not needed as we use in-memory only)
        }
    }
}, 10 * 60 * 1000);

// ==================== API: PAIRING (PER REQUEST SOCKET) ====================

app.get('/pair', async (req, res) => {
    const num = req.query.num;
    if (!num || !/^[0-9]{10,15}$/.test(num)) {
        return res.status(400).json({ success: false, error: "Invalid number. Use format: 2557XXXXXXXX" });
    }

    const sessionId = randomMegaId();
    console.log(`🔑 Generating pairing for ${num} | Session: ${sessionId}`);

    let sock;
    let responded = false;

    try {
        // Create a temporary auth folder for this session
        const authDir = path.join(__dirname, 'temp_auth', sessionId);
        await fs.mkdir(authDir, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        const version = [2, 3000, 1033105955]; // Stable version
        sock = makeWASocket({
            version,
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

        sock.ev.on('creds.update', saveCreds);

        // Request pairing code
        const code = await sock.requestPairingCode(num);
        console.log(`📱 Pairing code for ${num}: ${code}`);

        // Send code to client immediately
        res.json({ success: true, code, sessionId });
        responded = true;

        // Set expiry (30 minutes)
        tempPairings.set(sessionId, { phoneNumber: num, expiry: Date.now() + 30 * 60 * 1000 });

        // Handle connection update
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(`✅ ${num} successfully linked device. Saving to DB...`);

                // Save credentials to MongoDB
                const credsForDb = JSON.parse(JSON.stringify(state.creds, BufferJSON.replacer));
                await Session.findOneAndUpdate(
                    { phoneNumber: num },
                    { sessionId, phoneNumber: num, creds: credsForDb, status: 'paired' },
                    { upsert: true }
                );

                // Send welcome messages
                try {
                    const welcomeMsg = `╭─── • 🥀 • ───╮\n   INSIDIOUS BOT\n╰─── • 🥀 • ───╯\n\n✅ *Pairing Successful!*\n\n🆔 *SESSION ID:* \`${sessionId}\`\n\nCopy this ID, go to the website and paste it in the **Deploy** section to start your bot.`;

                    await sock.sendMessage(`${num}@s.whatsapp.net`, {
                        image: { url: "https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg" },
                        caption: welcomeMsg
                    });
                    await sock.sendMessage(`${num}@s.whatsapp.net`, { text: sessionId });
                    console.log(`📨 Welcome messages sent to ${num}`);
                } catch (msgErr) {
                    console.error('❌ Failed to send welcome messages:', msgErr);
                }

                // Clean up: close socket and remove temp folder
                sock?.end();
                await fs.rm(authDir, { recursive: true, force: true }).catch(() => {});
                tempPairings.delete(sessionId);
                console.log(`🔌 Pairing socket closed for ${num}`);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    // Unexpected close, but we don't need to restart anything
                    console.log(`⚠️ Pairing socket closed unexpectedly for ${num}: ${statusCode}`);
                }
                // Clean up
                sock?.end();
                await fs.rm(authDir, { recursive: true, force: true }).catch(() => {});
                tempPairings.delete(sessionId);
            }
        });

        sock.ev.on('error', (err) => {
            console.error(`❌ Socket error for ${num}:`, err);
            sock?.end();
            fs.rm(authDir, { recursive: true, force: true }).catch(() => {});
            tempPairings.delete(sessionId);
            if (!responded) {
                res.status(500).json({ success: false, error: "Pairing failed due to socket error." });
                responded = true;
            }
        });

    } catch (err) {
        console.error('❌ Pairing error:', err);
        sock?.end();
        if (!responded) {
            res.status(500).json({ success: false, error: err.message || "Server error during pairing." });
        }
    }
});

// ==================== API: DEPLOY ====================

const activeBots = new Map();

async function activateBot(sessionId, phoneNumber) {
    if (activeBots.has(sessionId)) {
        try { activeBots.get(sessionId).end(); } catch (e) {}
        activeBots.delete(sessionId);
    }

    try {
        const { state, saveCreds } = await useMongoAuthState(sessionId);

        const version = [2, 3000, 1033105955];
        const conn = makeWASocket({
            version,
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
        return res.status(400).json({ success: false, error: "Session ID and phone number are required." });
    }

    // Verify session exists and is paired (not yet active)
    const session = await Session.findOne({ sessionId, phoneNumber: number, status: 'paired' });
    if (!session) {
        return res.status(404).json({ success: false, error: "Session not found or already deployed. Please pair again." });
    }

    const result = await activateBot(sessionId, number);
    if (result.success) {
        res.json({ success: true, message: "Bot deployed successfully!" });
    } else {
        res.status(500).json({ success: false, error: result.error });
    }
});

// ==================== API: SESSIONS ====================

app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({}, { creds: 0 }).sort({ addedAt: -1 });
        res.json({ success: true, sessions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== API: DELETE SESSION ====================

app.delete('/sessions/:id', async (req, res) => {
    const sessionId = req.params.id;
    try {
        // Remove from DB
        await Session.deleteOne({ sessionId });
        await AuthKey.deleteMany({ sessionId });
        // Stop bot if running
        if (activeBots.has(sessionId)) {
            activeBots.get(sessionId).end();
            activeBots.delete(sessionId);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== API: SETTINGS ====================

app.post('/settings', (req, res) => {
    // Placeholder – implement if needed
    res.json({ success: true });
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        activeBots: activeBots.size,
        uptime: process.uptime()
    });
});

// ==================== STATIC FILES & FALLBACK ====================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== START SERVER ====================

const MONGODB_URI = process.env.MONGODB_URI; // No fallback – must be set in environment
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required!');
    process.exit(1);
}

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log(fancy("🟢 MongoDB Connected"));
        // Restore any previously active bots (those with status 'active')
        const activeSessions = await Session.find({ status: 'active' });
        for (const sess of activeSessions) {
            console.log(`♻️ Restoring bot ${sess.sessionId}...`);
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