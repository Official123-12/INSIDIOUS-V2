const config = require('../../config');
module.exports = {
    name: "self",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        config.workMode = "private";
        conn.sendMessage(from, { text: fancy("🥀 ʙᴏᴛ ɪꜱ ɴᴏᴡ ɪɴ ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ. ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴄᴏᴍᴍᴀɴᴅ ᴍᴇ.") });
    }
};
