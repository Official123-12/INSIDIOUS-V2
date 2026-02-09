const config = require('../../config');
module.exports = {
    name: "blockcountry",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        const prefix = args[0];
        if (!prefix) return msg.reply(fancy("ᴇɴᴛᴇʀ ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ (ᴇ.ɢ 92, 234)"));
        
        if (!config.autoblock.includes(prefix)) {
            config.autoblock.push(prefix);
            msg.reply(fancy(`🥀 ᴀʟʟ ɴᴜᴍʙᴇʀꜱ ꜱᴛᴀʀᴛɪɴɢ ᴡɪᴛʜ +${prefix} ᴡɪʟʟ ʙᴇ ʙʟᴏᴄᴋᴇᴅ.`));
        } else {
            msg.reply(fancy(`🥀 ᴘʀᴇꜰɪx +${prefix} ɪꜱ ᴀʟʀᴇᴀᴅʏ ɪɴ ᴛʜᴇ ʙʟᴀᴄᴋʟɪꜱᴛ.`));
        }
    }
};
