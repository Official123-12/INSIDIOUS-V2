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

        // 30. FORCE SUBSCRIBE LOGIC
        // (Weka check hapa user asipofuata channel asitumie bot)

        // 1. ANTI-LINK (Aggressive)
        const linkRegex = /(https?:\/\/|www\.|wa\.me|t\.me|\.com|\.net|\.org)/gi;
        if (from.endsWith('@g.us') && config.antilink && body.match(linkRegex) && !isOwner) {
            await conn.sendMessage(from, { delete: msg.key });
            await conn.groupParticipantsUpdate(from, [sender], "remove");
            return;
        }

        // 5 & 6. RECOVERY (Anti-ViewOnce / Anti-Delete)
        if (msg.message.viewOnceMessageV2 || msg.message.protocolMessage) {
            await conn.sendMessage(config.ownerNumber + "@s.whatsapp.net", { 
                forward: msg, 
                caption: fancy("Caught by Insidious Recovery"),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid } }
            });
        }

        // 11. HUMAN CHATBOT (Pollinations AI)
        if (!body.startsWith(config.prefix) && !msg.key.fromMe && !from.endsWith('@g.us')) {
            await conn.sendPresenceUpdate('composing', from);
            const ai = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(body)}?system=You are INSIDIOUS V2, a horror-themed AI. Reply in the user's exact language. Be human-like.`);
            return conn.sendMessage(from, { 
                text: fancy(ai.data),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: config.botName } }
            }, { quoted: msg });
        }

        // DYNAMIC COMMANDS
        if (body.startsWith(config.prefix)) {
            const command = body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            
            const categories = fs.readdirSync('./commands');
            for (const cat of categories) {
                const path = `./commands/${cat}/${command}.js`;
                if (fs.existsSync(path)) return require(path).execute(conn, msg, args, { from, sender, fancy, isOwner });
            }
        }
    } catch (e) { console.log(e); }
};
