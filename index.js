const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");
const { fancy } = require("./lib/font");
const app = express();

// 1. DATABASE & SESSION (Always Online)
mongoose.connect(config.mongodb).then(() => console.log("🥀 DB Connected"));

// 2. WEB PAIRING DASHBOARD
app.get('/', (res) => res.send(`<body style="background:#000;color:red;text-align:center;padding-top:100px;"><h1>🥀 INSIDIOUS V2 PANEL</h1><input type="text" id="n" placeholder="255..."><button onclick="fetch('/pair?num='+document.getElementById('n').value).then(r=>r.json()).then(d=>document.getElementById('c').innerText=d.code)">GET CODE</button><h2 id="c" style="color:white;letter-spacing:10px;"></h2></body>`));

async function startInsidious() {
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

    // 8. WELCOME & GOODBYE
    conn.ev.on('group-participants.update', async (anu) => {
        let metadata = await conn.groupMetadata(anu.id);
        let participants = anu.participants;
        for (let num of participants) {
            let pp = await conn.profilePictureUrl(num, 'image').catch(() => 'https://files.catbox.moe/horror.jpg');
            if (anu.action == 'add') {
                let msg = `╭── • 🥀 • ──╮\n  ${fancy("ᴡᴇʟᴄᴏᴍᴇ ꜱᴏᴜʟ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ᴜꜱᴇʀ: @${num.split("@")[0]}\n│ ◦ ɢʀᴏᴜᴘ: ${metadata.subject}\n│ ◦ ᴍᴇᴍʙᴇʀꜱ: ${metadata.participants.length}\n\n🥀 "${fancy("The Further awaits you.")}"`;
                await conn.sendMessage(anu.id, { image: { url: pp }, caption: msg, mentions: [num] });
            } else if (anu.action == 'remove') {
                let msg = `╭── • 🥀 • ──╮\n  ${fancy("ɢᴏᴏᴅʙʏᴇ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ꜱᴏᴜʟ ʟᴇꜰᴛ ᴛʜᴇ ɢʀᴏᴜᴘ.\n🥀 "${fancy("Another one lost to the shadows.")}"`;
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

    // 17. ANTICALL
    conn.ev.on('call', async (c) => {
        if (config.antiCall && c[0].status === 'offer') {
            await conn.rejectCall(c[0].id, c[0].from);
            await conn.sendMessage(c[0].from, { text: fancy("🥀 ɴᴏ ᴄᴀʟʟꜱ ᴀʟʟᴏᴡᴇᴅ.") });
        }
    });

    conn.ev.on('connection.update', (u) => { if (u.connection === 'open') console.log("👹 INSIDIOUS ACTIVE"); });
}
startInsidious();
app.listen(3000);
