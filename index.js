const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== CONFIG & MODELS ====================
const handler = require('./handler');

// MongoDB Schema to store sessions for deployment
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    creds: { type: Object, required: true }, 
    status: { type: String, default: 'active' },
    addedAt: { type: Date, default: Date.now }
});
const Session = mongoose.model('UserSession', sessionSchema);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **FANCY TEXT & ID GENERATOR**
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

// ✅ **DB CONNECTION**
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority")
    .then(() => {
        console.log(fancy("✅ Connected to MongoDB"));
        loadActiveBots();
    }).catch(err => console.log("❌ DB Error: " + err.message));

// ✅ **GLOBAL STORE FOR PAIRING SOCKETS**
// We use this to prevent session conflicts
let pairingSocket = null;

async function startPairingEngine() {
    // Clear old pairing cache to prevent "Enter code you requested" error
    if (fs.existsSync('./pairing_temp')) {
        fs.rmSync('./pairing_temp', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('pairing_temp');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"), // Fixed infinite loading
        syncFullHistory: false,
        printQRInTerminal: false
    });

    pairingSocket = conn;

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            const userJid = conn.user.id.split(':')[0];
            const sessionId = randomMegaId();

            // 1. Save all credentials to MongoDB
            await Session.findOneAndUpdate(
                { phoneNumber: userJid },
                { sessionId, phoneNumber: userJid, creds: state.creds, status: 'active' },
                { upsert: true }
            );

            // 2. Send Session ID to the user
            const msg = `╭─── • 🥀 • ───╮\n   INSIDIOUS BOT\n╰─── • 🥀 • ───╯\n\n✅ *Pairing Successful!*\n\n🆔 *SESSION ID:* \`${sessionId}\`\n\nCopy the ID above and paste it into the deployment website to start your bot.`;
            
            await conn.sendMessage(userJid + '@s.whatsapp.net', { text: msg });
            await conn.sendMessage(userJid + '@s.whatsapp.net', { text: sessionId });

            console.log(fancy(`✅ Session Created: ${sessionId}`));

            // 3. Logout and Cleanup (Crucial for the next user)
            setTimeout(async () => {
                await conn.logout();
                startPairingEngine(); // Restart engine for next user
            }, 5000);
        }

        if (connection === 'close') {
            const code = (lastDisconnect?.error)?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                startPairingEngine();
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);
}

// ✅ **BOT DEPLOYMENT LOGIC**
async function activateBot(sessionId, number) {
    try {
        const sessionData = await Session.findOne({ sessionId });
        if (!sessionData) return { success: false, error: "Session not found" };

        const { version } = await fetchLatestBaileysVersion();
        const conn = makeWASocket({
            version,
            auth: { 
                creds: sessionData.creds, 
                keys: makeCacheableSignalKeyStore(sessionData.creds.keys, pino({ level: "fatal" })) 
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome")
        });

        conn.ev.on('messages.upsert', async (m) => {
            await handler(conn, m);
        });

        console.log(fancy(`🚀 Bot Live: ${number}`));
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function loadActiveBots() {
    const active = await Session.find({ status: 'active' });
    for (let sess of active) {
        await activateBot(sess.sessionId, sess.phoneNumber);
    }
}

// ==================== ENDPOINTS ====================

app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.json({ success: false, error: "Number required" });

    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (!pairingSocket) return res.json({ success: false, error: "Engine starting, try again" });
        
        // Request pairing code from existing socket
        const code = await pairingSocket.requestPairingCode(cleanNum);
        res.json({ success: true, code });
    } catch (err) {
        console.log("Pairing Request Error:", err.message);
        res.json({ success: false, error: "Request timed out. Please refresh and try again." });
    }
});

app.post('/deploy', async (req, res) => {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) return res.json({ success: false, error: "Missing data" });
    const result = await activateBot(sessionId, number);
    res.json(result);
});

app.get('/sessions', async (req, res) => {
    const data = await Session.find({}, { creds: 0 }); 
    res.json({ success: true, sessions: data });
});

app.delete('/sessions/:id', async (req, res) => {
    await Session.deleteOne({ sessionId: req.params.id });
    res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start engine
startPairingEngine();

app.listen(PORT, () => console.log(`🌐 Server Running on Port ${PORT}`));