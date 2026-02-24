const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER ====================
const handler = require('./handler');

// ✅ **FANCY FUNCTION**
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const fancyMap = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', u: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
        };
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            result += fancyMap[char] || char;
        }
        return result;
    } catch (e) {
        return text;
    }
}

// ✅ **SESSION ID GENERATOR**
function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI)
.then(() => console.log(fancy("✅ MongoDB Connected")))
.catch((err) => console.log(fancy("❌ MongoDB FAILED: " + err.message)));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **GLOBAL VARIABLES**
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// ✅ **LOAD CONFIG**
let config = {};
try {
    config = require('./config');
} catch (error) {
    config = {
        prefix: '.',
        ownerNumber: ['255787069580'],
        botName: 'INSIDIOUS',
        workMode: 'public',
        botImage: 'https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg'
    };
}

// ✅ **MAIN BOT FUNCTION**
async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('insidious_session');
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
            markOnlineOnConnect: true
        });

        globalConn = conn;

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy("✅ Device Linked Successfully"));
                isConnected = true;
                
                const userJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
                const sessionId = randomMegaId(); // Generates ID like: ABCdef1234

                // 1️⃣ MESSAGE 1: FULL WELCOME
                const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS BOT SESSION
╰─── • 🥀 • ───╯

*Congratulations!* Your session has been generated successfully.

🆔 *Session ID:* \`${sessionId}\`

⚠️ *Next Step:*
Copy the Session ID below and paste it on our deployment website to make your bot active and online.

🚀 *Powered by:* STANYTZ
💾 *Version:* 3.0.0`;

                await conn.sendMessage(userJid, { 
                    image: { url: config.botImage || "https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg" },
                    caption: welcomeMsg,
                    contextInfo: { 
                        isForwarded: true,
                        forwardingScore: 999
                    }
                });

                // 2️⃣ MESSAGE 2: SESSION ID ONLY (FOR EASY COPYING)
                await conn.sendMessage(userJid, { text: sessionId });

                console.log(fancy(`✅ Session ID [${sessionId}] sent to ${userJid}`));
                console.log(fancy("🔒 Closing temporary connection..."));

                // ✅ CLOSE CONNECTION - Bot is not active until deployed on the web
                setTimeout(async () => {
                    await conn.logout();
                    process.exit(0); // Optional: restarts the pairing engine fresh
                }, 5000);
            }
            
            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    setTimeout(() => startBot(), 5000);
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error("Start error:", error.message);
        setTimeout(() => startBot(), 10000);
    }
}

startBot();

// ==================== HTTP ENDPOINTS ====================

app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) return res.json({ success: false, error: "Provide number!" });
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (!globalConn) return res.json({ success: false, error: "Bot initializing..." });
        
        const code = await globalConn.requestPairingCode(cleanNum);
        res.json({ success: true, code: code });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', connected: isConnected });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(fancy(`🌐 Server running on port ${PORT}`));
});

module.exports = app;