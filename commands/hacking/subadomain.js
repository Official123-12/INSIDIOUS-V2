const axios = require('axios');
module.exports = {
    name: "subdomain",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴇɴᴛᴇʀ ᴀ ᴍᴀɪɴ ᴅᴏᴍᴀɪɴ."));
        msg.reply(fancy("🥀 ʜᴀʀᴠᴇꜱᴛɪɴɢ ꜱᴜʙᴅᴏᴍᴀɪɴꜱ..."));
        try {
            const res = await axios.get(`https://api.hackertarget.com/hostsearch/?q=${args[0]}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ꜱᴜʙᴅᴏᴍᴀɪɴ ʟɪꜱᴛ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴅᴏᴍᴀɪɴ ɴᴏᴛ ʀᴇꜱᴘᴏɴᴅɪɴɢ."); }
    }
};
