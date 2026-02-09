const axios = require('axios');
module.exports = {
    name: "health",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ʜᴇᴀʟᴛʜ ᴛᴏᴘɪᴄ ꜱʜᴀʟʟ ᴡᴇ ᴅɪꜱᴄᴜꜱꜱ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Medical Professional. Provide educational information about: ${args.join(' ')}. Include symptoms, prevention, and advice. Always add a disclaimer that this is for educational purposes. Respond in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ʜᴇᴀʟᴛʜ ᴀᴅᴠɪꜱᴏʀ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ꜱʏꜱᴛᴇᴍ ꜰᴀɪʟᴜʀᴇ."); }
    }
};
