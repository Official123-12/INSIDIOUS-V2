const config = require('../../config');
module.exports = {
    name: "antispam",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (args[0] === 'off') {
            config.antispam = false;
            return msg.reply(fancy("🥀 ᴀɴᴛɪ-ꜱᴘᴀᴍ ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ."));
        }
        const limit = parseInt(args[1]) || 5;
        config.antispam = true;
        config.spamLimit = limit;
        msg.reply(fancy(`🥀 ᴀɴᴛɪ-ꜱᴘᴀᴍ ᴀᴄᴛɪᴠᴇ. ʟɪᴍɪᴛ: ${limit} ᴍꜱɢꜱ/ᴍɪɴ.`));
    }
};
