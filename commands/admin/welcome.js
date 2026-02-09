const config = require('../../config');
module.exports = {
    name: "setwelcome",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (!args[0]) return msg.reply(fancy("ᴜꜱᴀɢᴇ: .ꜱᴇᴛᴡᴇʟᴄᴏᴍᴇ ᴏɴ/ᴏꜰꜰ"));
        config.welcome = args[0] === 'on';
        msg.reply(fancy(`🥀 ᴡᴇʟᴄᴏᴍᴇ ᴍᴇꜱꜱᴀɢᴇꜱ ᴀʀᴇ ɴᴏᴡ ${args[0].toUpperCase()}`));
    }
};
