const express = require('express');
const { default: makeWASocket, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason, initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

const handler = require('./handler');

// ✅ FANCY FUNCTION
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    const fancyMap = {
        a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
        j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
        s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
    };
    return text.split('').map(c => fancyMap[c.toLowerCase()] || c).join('');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MONGODB SCHEMA
const AuthSchema = new mongoose.Schema({ sessionId: String, id: String, data: String });
const AuthDB = mongoose.models.AuthDB || mongoose.model('AuthDB', AuthSchema);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI).then(async () => {
    console.log(fancy("✅ MongoDB Connected"));
    const savedSessions = await AuthDB.distinct('sessionId');
    for (const sessionId of savedSessions) {
        if (sessionId !== 'temp_pairing') startBot(sessionId);
    }
});

// ✅ SESSION MANAGER (MongoDB)
async function useMongoDBAuthState(sessionId) {
    const writeData = async (data, id) => {
        const stringified = JSON.stringify(data, BufferJSON.replacer);
        await AuthDB.updateOne({ sessionId, id }, { data: stringified }, { upsert: true });
    };
    const readData = async (id) => {
        const doc = await AuthDB.findOne({ sessionId, id });
        return doc ? JSON.parse(doc.data, BufferJSON.reviver) : null;
    };
    const removeData = async (id) => await AuthDB.deleteOne({ sessionId, id });

    let creds = await readData('creds') || initAuthCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            if (value) await writeData(value, `${category}-${id}`);
                            else await removeData(`${category}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

const globalConns = new Map();

async function startBot(sessionId) {
    try {
        const { state, saveCreds } = await useMongoDBAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: false
        });

        globalConns.set(sessionId, conn);

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(fancy(`✅ Bot Online: ${sessionId}`));
                try {
                    await conn.sendMessage(conn.user.id, { text: fancy("insidious bot connected successfully!") });
                } catch (e) {}
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    setTimeout(() => startBot(sessionId), 5000);
                } else {
                    await AuthDB.deleteMany({ sessionId });
                    globalConns.delete(sessionId);
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', async (m) => { if (handler) handler(conn, m); });

        return conn;
    } catch (e) {
        console.error("Error starting bot:", e);
    }
}

app.use(express.static(path.join(__dirname, 'public')));

// ✅ PAIRING ENDPOINT – COMPLETELY FIXED & ROBUST
app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.json({ error: "No number provided" });
    const cleanNum = num.replace(/[^0-9]/g, '');
    if (cleanNum.length < 10) return res.json({ error: "Invalid number" });

    try {
        // 1. Clear any existing session for this number to avoid conflicts
        await AuthDB.deleteMany({ sessionId: cleanNum });

        // 2. Create temporary auth state
        const { state, saveCreds } = await useMongoDBAuthState(cleanNum);
        const { version } = await fetchLatestBaileysVersion();

        // 3. Create temporary socket for pairing only
        const tempConn = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false
        });

        let codeReceived = false;
        const timeout = setTimeout(() => {
            if (!codeReceived) {
                tempConn.end();
                res.json({ error: "Pairing timeout – please try again." });
            }
        }, 60000); // 60 seconds timeout

        tempConn.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    const code = await tempConn.requestPairingCode(cleanNum);
                    codeReceived = true;
                    clearTimeout(timeout);
                    res.json({ success: true, code: code });
                    
                    // Save credentials if they update during this short session
                    tempConn.ev.on('creds.update', saveCreds);
                    
                    // Close the temporary socket after a short delay (code already sent)
                    setTimeout(() => tempConn.end(), 5000);
                } catch (err) {
                    console.error("Pairing code request failed:", err);
                    if (!codeReceived) {
                        clearTimeout(timeout);
                        res.json({ error: "Failed to get code – please try again." });
                    }
                    tempConn.end();
                }
            }
        });

    } catch (e) {
        console.error("Pairing error:", e);
        res.json({ error: "Internal Server Error" });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'running', bots: globalConns.size });
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));