const config = require('../../config');
module.exports = {
    name: "adminset",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        const feature = args[0]?.toLowerCase();
        const action = args[1]?.toLowerCase();

        if (!feature || !['on', 'off'].includes(action)) {
            return msg.reply(fancy("ᴜꜱᴀɢᴇ: .ᴀᴅᴍɪɴꜱᴇᴛ [ᴀɴᴛɪʟɪɴᴋ/ᴀɴᴛɪᴘᴏʀɴ/ᴀɴᴛɪꜱᴄᴀᴍ/ᴀɴᴛɪᴛᴀɢ] [ᴏɴ/ᴏꜰꜰ]"));
        }

        config[feature] = action === 'on';
        conn.sendMessage(from, { 
            text: fancy(`🥀 ꜱᴇᴛᴛɪɴɢ ᴜᴘᴅᴀᴛᴇᴅ:\n${feature.toUpperCase()} ɪꜱ ɴᴏᴡ ${action.toUpperCase()}`),
            contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: config.botName } }
        });
    }
};
