const express = require('express');
const {
    default: makeWASocket,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    Browsers,
    BufferJSON,
    proto
} = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not set in environment variables");
    process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const handler = require('./handler');


// ===================== DATABASE =====================

mongoose.connect(MONGODB_URI);

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, unique: true },
    phoneNumber: String,
    creds: Object,
    status: { type: String, default: "active" },
    addedAt: { type: Date, default: Date.now }
});
const Session = mongoose.model("Session", sessionSchema);

const authKeySchema = new mongoose.Schema({
    sessionId: String,
    keyId: String,
    data: Object
});
authKeySchema.index({ sessionId: 1, keyId: 1 }, { unique: true });
const AuthKey = mongoose.model("AuthKey", authKeySchema);


// ===================== MONGO AUTH =====================

async function useMongoAuthState(sessionId) {

    const writeData = async (data, keyId) => {
        await AuthKey.updateOne(
            { sessionId, keyId },
            { $set: { data: JSON.parse(JSON.stringify(data, BufferJSON.replacer)) } },
            { upsert: true }
        );
    };

    const readData = async (keyId) => {
        const data = await AuthKey.findOne({ sessionId, keyId });
        return data ? JSON.parse(JSON.stringify(data.data), BufferJSON.reviver) : null;
    };

    const removeData = async (keyId) => {
        await AuthKey.deleteOne({ sessionId, keyId });
    };

    const session = await Session.findOne({ sessionId });
    if (!session) throw new Error("Session not found");

    return {
        state: {
            creds: JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver),
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const keyId = `${category}-${id}`;
                            if (value) await writeData(value, keyId);
                            else await removeData(keyId);
                        }
                    }
                }
            }
        },
        saveCreds: async (creds) => {
            await Session.updateOne(
                { sessionId },
                { $set: { creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)) } }
            );
        }
    };
}


// ===================== PAIRING ENGINE =====================

let pairingSocket = null;

async function startPairingEngine() {

    if (pairingSocket) return;

    const { state, saveCreds } = await useMultiFileAuthState('./pairing_temp');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        connectTimeoutMs: 60000
    });

    pairingSocket = conn;

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

        if (connection === 'open') {

            const user = conn.user.id.split(":")[0];
            const sessionId = generateId();

            await Session.create({
                sessionId,
                phoneNumber: user,
                creds: JSON.parse(JSON.stringify(state.creds, BufferJSON.replacer)),
                status: "inactive"
            });

            await conn.sendMessage(user + "@s.whatsapp.net", {
                text: `✅ Pairing Successful!\n\nSession ID:\n${sessionId}`
            });

            setTimeout(() => {
                conn.end();
                pairingSocket = null;
                fs.rmSync('./pairing_temp', { recursive: true, force: true });
                startPairingEngine();
            }, 4000);
        }

        if (connection === 'close') {
            pairingSocket = null;
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(startPairingEngine, 5000);
            }
        }

    });
}


// ===================== ACTIVATE BOT =====================

const activeBots = new Map();

async function activateBot(sessionId) {

    const session = await Session.findOne({ sessionId });
    if (!session) return { success: false, error: "Session not found" };

    const { state, saveCreds } = await useMongoAuthState(sessionId);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        browser: Browsers.ubuntu("Chrome"),
        logger: pino({ level: "silent" }),
        markOnlineOnConnect: true,
        syncFullHistory: false,
        keepAliveIntervalMs: 30000
    });

    activeBots.set(sessionId, conn);

    conn.ev.on('creds.update', async () => {
        await saveCreds(conn.authState.creds);
    });

    conn.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

        if (connection === "open") {
            await Session.updateOne({ sessionId }, { $set: { status: "active" } });
            console.log("🚀 BOT ACTIVE:", sessionId);
        }

        if (connection === "close") {
            activeBots.delete(sessionId);
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => activateBot(sessionId), 5000);
            } else {
                await Session.deleteOne({ sessionId });
                await AuthKey.deleteMany({ sessionId });
            }
        }

    });

    conn.ev.on("messages.upsert", async (m) => {
        try { await handler(conn, m); } catch {}
    });

    return { success: true };
}


// ===================== RESTORE ON RESTART =====================

async function restoreBots() {
    const sessions = await Session.find({ status: "active" });
    for (const s of sessions) {
        activateBot(s.sessionId);
    }
}


// ===================== API =====================

app.get("/pair", async (req, res) => {
    if (!pairingSocket) return res.json({ success: false });
    const number = req.query.number;
    const code = await pairingSocket.requestPairingCode(number);
    res.json({ success: true, code });
});

app.post("/deploy", async (req, res) => {
    const { sessionId } = req.body;
    const result = await activateBot(sessionId);
    res.json(result);
});

app.get("/health", (req, res) => {
    res.json({
        status: "running",
        activeBots: activeBots.size,
        uptime: process.uptime()
    });
});


// ===================== UTIL =====================

function generateId(len = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}


// ===================== SAFE EXIT =====================

process.on("SIGINT", () => {
    for (const bot of activeBots.values()) {
        try { bot.end(); } catch {}
    }
    process.exit(0);
});


// ===================== START =====================

app.listen(PORT, async () => {
    console.log("🟢 INSIDIOUS BOT SERVER RUNNING ON PORT", PORT);
    await startPairingEngine();
    await restoreBots();
});

module.exports = app;