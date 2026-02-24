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
const cors = require('cors');

// ==================== CONFIG & HANDLER ====================
const handler = require('./handler');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== DATABASE SCHEMAS ====================

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String, required: true },
    creds: { type: Object, required: true },
    status: { type: String, default: 'active', index: true },
    addedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    lastConnected: { type: Date }
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

// ==================== PAIRING STATION (EPHEMERAL) ====================

let pairingSocket = null;

async function startPairingEngine() {
    if (fs.existsSync('./pairing_temp')) fs.rmSync('./pairing_temp', { recursive: true, force: true });

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
        connectTimeoutMs: 60000
    });

    pairingSocket = conn;

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            const userJid = conn.user.id.split(':')[0];
            const sessionId = randomMegaId();

            console.log(fancy(`✨ Linking successful for ${userJid}. Saving to DB...`));

            await Session.findOneAndUpdate(
                { phoneNumber: userJid },
                { 
                    sessionId, 
                    phoneNumber: userJid, 
                    creds: JSON.parse(JSON.stringify(state.creds, BufferJSON.replacer)), 
                    status: 'active' 
                },
                { upsert: true }
            );

            const welcomeMsg = `╭─── • 🥀 • ───╮\n   INSIDIOUS BOT\n╰─── • 🥀 • ───╯\n\n✅ *Pairing Successful!*\n\n🆔 *SESSION ID:* \`${sessionId}\`\n\nCopy this ID then go to the website to start your bot now.`;
            
            await conn.sendMessage(userJid + '@s.whatsapp.net', { 
                image: { url: "https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg" },
                caption: welcomeMsg
            });
            await conn.sendMessage(userJid + '@s.whatsapp.net', { text: sessionId });

            setTimeout(() => {
                conn.ev.removeAllListeners();
                conn.ws.close();
                if (fs.existsSync('./pairing_temp')) fs.rmSync('./pairing_temp', { recursive: true, force: true });
                console.log(fancy("🔒 Pairing station closed. Creds are safe in MongoDB."));
                startPairingEngine();
            }, 5000);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut && connection !== 'open') {
                startPairingEngine();
            }
        }
    });
}

// ==================== DEPLOYMENT SYSTEM (LIVE BOTS) ====================

const activeBots = new Map();

async function activateBot(sessionId, number) {
    if (activeBots.has(sessionId)) {
        try { activeBots.get(sessionId).ws.close(); } catch (e) {}
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

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                await Session.updateOne({ sessionId }, { $set: { status: 'active' } });
                console.log(`🚀 [BOT ONLINE] ID: ${sessionId} | Number: ${number}`);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    setTimeout(() => activateBot(sessionId, number), 5000);
                } else {
                    await Session.deleteOne({ sessionId });
                    await AuthKey.deleteMany({ sessionId });
                    activeBots.delete(sessionId);
                }
            }
        });

        conn.ev.on('messages.upsert', async (m) => {
            try { await handler(conn, m); } catch (e) {}
        });

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function loadActiveBots() {
    try {
        const active = await Session.find({ status: 'active' });
        for (const sess of active) {
            await new Promise(r => setTimeout(r, 2000)); 
            activateBot(sess.sessionId, sess.phoneNumber);
        }
    } catch (e) {}
}

// ==================== API ENDPOINTS ====================

app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.json({ success: false, error: "Number required" });
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (!pairingSocket) return res.json({ success: false, error: "Engine initializing" });
        const code = await pairingSocket.requestPairingCode(cleanNum);
        res.json({ success: true, code });
    } catch (err) {
        res.json({ success: false, error: "Pairing failed. Retry." });
    }
});

app.post('/deploy', async (req, res) => {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) return res.json({ success: false, error: "Missing data" });
    const result = await activateBot(sessionId, number);
    res.json(result);
});

app.get('/sessions', async (req, res) => {
    try {
        const data = await Session.find({}, { creds: 0 }).sort({ addedAt: -1 });
        res.json({ success: true, sessions: data });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.delete('/sessions/:id', async (req, res) => {
    try {
        const sid = req.params.id;
        await Session.deleteOne({ sessionId: sid });
        await AuthKey.deleteMany({ sessionId: sid });
        if (activeBots.has(sid)) {
            activeBots.get(sid).ws.close();
            activeBots.delete(sid);
        }
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// NEW: Settings endpoint for frontend
app.post('/settings', async (req, res) => {
    try {
        console.log('Settings saved:', req.body);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// Health check - Railway compatible
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== RUN ====================

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI).then(() => {
    console.log(fancy("🟢 INSIDIOUS STATION LIVE"));
    startPairingEngine();
    loadActiveBots();
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Port: ${PORT}`));

module.exports = app;
