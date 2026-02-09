const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { fancy } = require("./lib/tools");
const app = express();

mongoose.connect(config.mongodb).then(() => console.log("🥀 DB Connected"));

app.get('/', (req, res) => {
    res.send(`<body style="background:#000;color:red;text-align:center;padding-top:100px;font-family:sans-serif;">
        <h1>🥀 INSIDIOUS V2 PANEL</h1>
        <p style="color:white">Enter number with Country Code (255...)</p>
        <input type="text" id="n" style="padding:15px;text-align:center;"><br><br>
        <button onclick="fetch('/pair?num='+document.getElementById('n').value).then(r=>r.json()).then(d=>document.getElementById('c').innerText=d.code)">GET PAIRING CODE</button>
        <h2 id="c" style="color:white;letter-spacing:10px;font-size:40px;"></h2></body>`);
});

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const conn = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari")
    });

    app.get('/pair', async (req, res) => {
        let num = req.query.num;
        if(!conn.authState.creds.registered) {
            await delay(3000);
            const code = await conn.requestPairingCode(num);
            res.json({ code });
        }
    });

    conn.ev.on('creds.update', saveCreds);
    conn.ev.on('connection.update', async (u) => {
        if (u.connection === 'open') {
            console.log("👹 INSIDIOUS ONLINE");
            const welcomeMsg = `╭── • 🥀 • ──╮\n  ${fancy("ꜱʏꜱᴛᴇᴍ ʟɪɴᴋᴇᴅ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ʙᴏᴛ: ${config.botName}\n│ ◦ ᴅᴇᴠ: ${config.ownerName}\n│ ◦ ꜱᴛᴀᴛᴜꜱ: ᴀᴄᴛɪᴠᴇ\n└──────────────`;
            await conn.sendMessage(conn.user.id, { text: welcomeMsg });
        }
    });

    conn.ev.on('messages.upsert', (m) => require('./handler')(conn, m));
}
start();
app.listen(3000);
