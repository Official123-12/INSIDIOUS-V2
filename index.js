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
const fs = require('fs');
const Boom = require('@hapi/boom');
const cors = require('cors');

// ==================== CONFIG & HANDLER ====================
const handler = require('./handler');
const app = express();
const PORT = process.env.PORT || 3000;

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
    const MAX_RETRIES = 3;
    
    const writeData = async (data, keyId, attempt = 1) => {
        try {
            await AuthKey.updateOne(
                { sessionId, keyId },
                { $set: { data: JSON.parse(JSON.stringify(data, BufferJSON.replacer)) } },
                { upsert: true }
            );
        } catch (e) { 
            console.error(`AuthKey Save Error (attempt ${attempt}):`, e); 
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1000));
                return writeData(data, keyId, attempt + 1);
            }
        }
    };

    const readData = async (keyId, attempt = 1) => {
        try {
            const res = await AuthKey.findOne({ sessionId, keyId });
            return res ? JSON.parse(JSON.stringify(res.data), BufferJSON.reviver) : null;
        } catch (e) { 
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1000));
                return readData(keyId, attempt + 1);
            }
            return null; 
        }
    };

    const removeData = async (keyId) => {
        try { await AuthKey.deleteOne({ sessionId, keyId }); } catch (e) { }
    };

    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB not connected");
    }

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
                        try {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        } catch (err) {
                            console.error(`Error reading key ${type}-${id}:`, err);
                            data[id] = null;
                        }
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const keyId = `${category}-${id}`;
                            try {
                                value ? await writeData(value, keyId) : await removeData(keyId);
                            } catch (err) {
                                console.error(`Error writing key ${keyId}:`, err);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            try {
                await Session.updateOne(
                    { sessionId },
                    { $set: { 
                        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
                        lastActive: new Date()
                    } }
                );
            } catch (err) {
                console.error('Save creds error:', err);
                throw err;
            }
        }
    };
};

// ==================== UTILITIES ====================

function fancy(text) {
    const map = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u:: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
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
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 60000
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

            await new Promise(resolve => setTimeout(resolve, 2000));

            const welcomeMsg = `╭─── • 🥀 • ───╮\n   INSIDIOUS BOT\n╰─── • 🥀 • ───╯\n\n✅ *Pairing Successful!*\n\n🆔 *SESSION ID:* \`${sessionId}\`\n\nCopy this ID then go to the website to start your bot now.`;
            
            try {
                await conn.sendMessage(userJid + '@s.whatsapp.net', { 
                    image: { url: "https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg" },
                    caption: welcomeMsg
                });
                await conn.sendMessage(userJid + '@s.whatsapp.net', { text: sessionId });
                
                console.log(fancy("✅ Messages sent successfully"));
            } catch (sendErr) {
                console.error("Failed to send messages:", sendErr);
            }

            setTimeout(async () => {
                try {
                    await conn.logout();
                } catch (e) {}
                
                conn.ev.removeAllListeners();
                if (fs.existsSync('./pairing_temp')) {
                    fs.rmSync('./pairing_temp', { recursive: true, force: true });
                }
                console.log(fancy("🔒 Pairing station closed. Creds are safe in MongoDB."));
                startPairingEngine();
            }, 10000);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;
                
            if (shouldReconnect && code !== DisconnectReason.loggedOut) {
                console.log("Pairing engine reconnecting...");
                setTimeout(startPairingEngine, 3000);
            }
        }
    });
    
    conn.ev.on('error', (err) => {
        console.error('Pairing Socket Error:', err);
    });
}

// ==================== DEPLOYMENT SYSTEM (LIVE BOTS) ====================

const activeBots = new Map();

async function activateBot(sessionId, number) {
    if (activeBots.has(sessionId)) {
        console.log(`Bot ${sessionId} already active, restarting...`);
        try { 
            const oldSock = activeBots.get(sessionId);
            oldSock.ev.removeAllListeners();
            await oldSock.logout().catch(() => {});
        } catch (e) {}
        activeBots.delete(sessionId);
        await new Promise(r => setTimeout(r, 2000));
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
            markOnlineOnConnect: true,
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            retryRequestDelayMs: 1000
        });

        activeBots.set(sessionId, conn);

        let isConnected = false;

        conn.ev.on('creds.update', async () => {
            try {
                await saveCreds();
            } catch (err) {
                console.error(`Failed to save creds for ${sessionId}:`, err);
            }
        });

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                isConnected = true;
                await Session.updateOne({ sessionId }, { 
                    $set: { 
                        status: 'active',
                        lastConnected: new Date()
                    } 
                });
                console.log(`🚀 [BOT ONLINE] ID: ${sessionId} | Number: ${number}`);
            }

            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                
                console.log(`[BOT DISCONNECT] ${sessionId} | Code: ${statusCode} | Reason: ${errorMessage}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`[BOT LOGOUT] ${sessionId} - Cleaning up...`);
                    await Session.deleteOne({ sessionId });
                    await AuthKey.deleteMany({ sessionId });
                    activeBots.delete(sessionId);
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log(`[BOT REPLACED] ${sessionId} - Another instance connected`);
                    activeBots.delete(sessionId);
                } else {
                    const delay = Math.min(5000 * (activeBots.has(sessionId) ? 2 : 1), 30000);
                    console.log(`[BOT RECONNECT] ${sessionId} in ${delay}ms...`);
                    setTimeout(() => {
                        if (!isConnected) activateBot(sessionId, number);
                    }, delay);
                }
            }
        });

        conn.ev.on('messages.upsert', async (m) => {
            try { 
                await handler(conn, m); 
            } catch (e) {
                console.error(`Handler error for ${sessionId}:`, e);
            }
        });

        conn.ev.on('error', (err) => {
            console.error(`Socket error for ${sessionId}:`, err);
        });

        return { success: true };
    } catch (e) {
        console.error(`Failed to activate bot ${sessionId}:`, e);
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
            try {
                await activeBots.get(sid).logout();
            } catch (e) {}
            activeBots.delete(sid);
        }
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// NEW: Settings endpoint (required by frontend)
app.post('/settings', async (req, res) => {
    try {
        console.log('Settings saved:', req.body);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// Health check (original format)
app.get('/health', (req, res) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const activeSessions = activeBots.size;
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongoStatus,
        activeBots: activeSessions,
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== RUN ====================

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    w: 'majority'
};

mongoose.connect(MONGODB_URI, mongooseOptions).then(() => {
    console.log(fancy("🟢 INSIDIOUS STATION LIVE"));
    console.log(fancy("🟢 MongoDB Connected"));
    startPairingEngine();
    loadActiveBots();
}).catch(err => {
    console.error("MongoDB Connection Failed:", err);
    process.exit(1);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected! Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected!');
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    
    for (const [sessionId, sock] of activeBots.entries()) {
        try {
            await sock.logout().catch(() => {});
        } catch (e) {}
    }
    
    await mongoose.connection.close();
    process.exit(0);
});

app.listen(PORT, () => console.log(`🚀 Port: ${PORT}`));

module.exports = app;
