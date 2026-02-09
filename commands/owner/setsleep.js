const config = require('../../config');
module.exports = {
    name: "setsleep",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (!args[0] || !args[1]) return msg.reply("🥀 Usage: .setsleep 22:00 06:00");
        config.sleepStart = args[0];
        config.sleepEnd = args[1];
        conn.sendMessage(from, { text: fancy(`🥀 ꜱʟᴇᴇᴘɪɴɢ ᴍᴏᴅᴇ ꜱᴇᴛ: ${args[0]} ᴛᴏ ${args[1]}`) });
    }
};
