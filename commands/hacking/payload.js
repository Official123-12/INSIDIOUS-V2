const axios = require('axios');
module.exports = {
    name: "payload",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜɪᴄʜ ᴏꜱ? (ᴇ.ɢ. ᴀɴᴅʀᴏɪᴅ, ᴡɪɴᴅᴏᴡꜱ)"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Provide the msfvenom commands to generate reverse shell payloads for ${args[0]}. Explain each part of the command. Educational use only.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴘᴀʏʟᴏᴀᴅ ɢᴇɴᴇʀᴀᴛᴏʀ (ᴍꜱꜰᴠᴇɴᴏᴍ):*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴇʀʀᴏʀ ɪɴ ʟᴏɢɪᴄ."); }
    }
};
