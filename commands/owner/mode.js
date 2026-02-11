const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "mode",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;
        let choice = args[0]?.toLowerCase();

        if (choice === 'public') {
            config.workMode = 'public';
            msg.reply(fancy("🥀 ʙᴏᴛ ɪꜱ ɴᴏᴡ ɪɴ ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ."));
        } else if (choice === 'self' || choice === 'private') {
            config.workMode = 'private';
            msg.reply(fancy("🥀 ʙᴏᴛ ɪꜱ ɴᴏᴡ ɪɴ ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ."));
        } else {
            msg.reply(fancy("ᴜꜱᴀɢᴇ: .ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ/ꜱᴇʟꜰ"));
        }
    }
};