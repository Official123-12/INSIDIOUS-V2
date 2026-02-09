const fs = require('fs-extra');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');

module.exports = async (conn, m) => {
    try {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const isOwner = sender.includes(config.ownerNumber) || msg.key.fromMe;

        // 1. BROAD ANTI-LINK (All links)
        if (from.endsWith('@g.us') && !isOwner && body.match(/https?:\/\//gi)) {
            await conn.sendMessage(from, { delete: msg.key });
            await conn.groupParticipantsUpdate(from, [sender], "remove");
            return;
        }

        // 11. CHATBOT (AI MIRROR)
        if (!body.startsWith(config.prefix) && !msg.key.fromMe && !from.endsWith('@g.us')) {
            const ai = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(body)}?system=You are INSIDIOUS V2. Reply in same language as user. Be very human.`);
            return conn.sendMessage(from, { text: fancy(ai.data), contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: config.botName } } }, { quoted: msg });
        }

        // DYNAMIC COMMAND LOADER
        if (body.startsWith(config.prefix)) {
            const command = body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            
            const categories = fs.readdirSync('./commands');
            for (const cat of categories) {
                const path = `./commands/${cat}/${command}.js`;
                if (fs.existsSync(path)) {
                    return require(path).execute(conn, msg, args, { from, sender, fancy, isOwner });
                }
            }
        }
    } catch (e) { console.log(e); }
};
