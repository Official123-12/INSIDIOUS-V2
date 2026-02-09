const axios = require('axios');
module.exports = {
    name: "email",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ɪꜱ ᴛʜᴇ ᴇᴍᴀɪʟ ᴀʙᴏᴜᴛ? (ᴇ.ɢ. ꜱɪᴄᴋ ʟᴇᴀᴠᴇ)"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Write a professional and formal email for: ${args.join(' ')}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴘʀᴏꜰᴇꜱꜱɪᴏɴᴀʟ ᴇᴍᴀɪʟ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅʀᴀꜰᴛ ᴇᴍᴀɪʟ."); }
    }
};
