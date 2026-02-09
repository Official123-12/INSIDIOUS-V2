const config = require('../../config');
module.exports = {
    name: "public",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        config.workMode = "public";
        conn.sendMessage(from, { text: fancy("🥀 ʙᴏᴛ ɪꜱ ɴᴏᴡ ɪɴ ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ. ᴀʟʟ ꜱᴏᴜʟꜱ ᴄᴀɴ ᴜꜱᴇ ɪᴛ.") });
    }
};
