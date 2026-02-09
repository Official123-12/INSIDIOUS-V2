const axios = require('axios');
module.exports = {
    name: "essay",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ꜱʜᴏᴜʟᴅ ᴛʜᴇ ᴇꜱꜱᴀʏ ʙᴇ ᴀʙᴏᴜᴛ?"));
        msg.reply(fancy("🥀 ᴅʀᴀꜰᴛɪɴɢ ʏᴏᴜʀ ᴇꜱꜱᴀʏ..."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Write a professional 500-word essay on: ${args.join(' ')}. Use formal academic language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴇꜱꜱᴀʏ ᴡʀɪᴛᴇʀ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ꜰᴀɪʟᴇᴅ ᴛᴏ ᴡʀɪᴛᴇ ᴇꜱꜱᴀʏ."); }
    }
};
