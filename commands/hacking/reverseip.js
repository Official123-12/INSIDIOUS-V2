const axios = require('axios');
module.exports = {
    name: "reverseip",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴀɴ ɪᴘ ᴀᴅᴅʀᴇꜱꜱ."));
        try {
            const res = await axios.get(`https://api.hackertarget.com/reverseiplookup/?q=${args[0]}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ʀᴇᴠᴇʀꜱᴇ ɪᴘ ʀᴇꜱᴜʟᴛꜱ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ɪᴘ ɴᴏᴛ ꜰᴏᴜɴᴅ."); }
    }
};
