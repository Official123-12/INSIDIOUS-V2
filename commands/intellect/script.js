const axios = require('axios');
module.exports = {
    name: "script",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ᴋɪɴᴅ ᴏꜰ ꜱᴄʀɪᴘᴛ ᴏʀ ꜱᴘᴇᴇᴄʜ ᴅᴏ ʏᴏᴜ ɴᴇᴇᴅ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Professional Scriptwriter. Write a script or speech for: ${args.join(' ')}. Reply in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ꜱᴄʀɪᴘᴛᴡʀɪᴛᴇʀ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴡʀɪᴛᴇʀ'ꜱ ʙʟᴏᴄᴋ."); }
    }
};
