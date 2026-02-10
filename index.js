const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");
const { fancy } = require("./lib/font");
const app = express();

mongoose.connect(config.mongodb).then(() => console.log("🥀 DB Active"));

app.get('/', (req, res) => {
    res.send(`<body style="background:#000;color:red;text-align:center;padding-top:100px;font-family:sans-serif;">
        <h1>🥀 INSIDIOUS V2 DASHBOARD</h1>
        <input type="text" id="n" placeholder="255..."><br><br>
        <button onclick="fetch('/pair?num='+document.getElementById('n').value).then(r=>r.json()).then(d=>document.getElementById('c').innerText=d.code)">GET PAIRING CODE</button>
        <h2 id="c" style="color:white;letter-spacing:10px;font-size:40px;"></h2></body>`);
});

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const conn = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari")
    });

    app.get('/pair', async (req, res) => {
        if(!conn.authState.creds.registered) {
            await delay(3000);
            const code = await conn.requestPairingCode(req.query.num);
            res.json({ code });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // 8. WELCOME & GOODBYE WITH QUOTES
    conn.ev.on('group-participants.update', async (anu) => {
        let metadata = await conn.groupMetadata(anu.id);
        let participants = anu.participants;
        for (let num of participants) {
            let pp = await conn.profilePictureUrl(num, 'image').catch(() => 'https://files.catbox.moe/horror.jpg');
            let quote = await axios.get('https://api.quotable.io/random').then(res => res.data.content).catch(() => "Stay in the shadows.");
            
            if (anu.action == 'add') {
                let msg = `╭── • 🥀 • ──╮\n  ${fancy("ᴡᴇʟᴄᴏᴍᴇ ꜱᴏᴜʟ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ᴜꜱᴇʀ: @${num.split("@")[0]}\n│ ◦ ᴍᴇᴍʙᴇʀꜱ: ${metadata.participants.length}\n\n🥀 "${fancy(quote)}"`;
                await conn.sendMessage(anu.id, { image: { url: pp }, caption: msg, mentions: [num] });
            } else if (anu.action == 'remove') {
                let msg = `╭── • 🥀 • ──╮\n  ${fancy("ɢᴏᴏᴅʙʏᴇ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ${fancy("ᴀɴᴏᴛʜᴇʀ ᴏɴᴇ ʟᴏꜱᴛ.")}\n🥀 "${fancy(quote)}"`;
                await conn.sendMessage(anu.id, { image: { url: pp }, caption: msg, mentions: [num] });
            }
        }
    });

    // 12. AUTO STATUS & 13. AUTO READ
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (msg.key.remoteJid === 'status@broadcast' && config.autoStatus.view) {
            await conn.readMessages([msg.key]);
            if (config.autoStatus.like) await conn.sendMessage('status@broadcast', { react: { text: '🥀', key: msg.key } }, { statusJidList: [msg.key.participant] });
        }
        require('./handler')(conn, m);
    });

    conn.ev.on('connection.update', (u) => { 
        if (u.connection === 'open') {
            console.log("👹 INSIDIOUS ACTIVE");
            conn.sendMessage(conn.user.id, { text: fancy("ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1 ᴀᴄᴛɪᴠᴀᴛᴇᴅ") });
        }
    });
}
start();
app.listen(3000);
