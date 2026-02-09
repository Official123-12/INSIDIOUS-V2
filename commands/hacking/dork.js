const axios = require('axios');
module.exports = {
    name: "dork",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ɪꜱ ᴛʜᴇ ᴛᴀʀɢᴇᴛ? (ᴇ.ɢ. ᴄᴀᴍᴇʀᴀ, ᴘᴅꜰ)"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Provide 5 powerful Google Dorks for searching ${args.join(' ')}. Explain what each dork does.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ᴅᴏʀᴋɪɴɢ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ɢᴏᴏɢʟᴇ ɪꜱ ᴡᴀᴛᴄʜɪɴɢ."); }
    }
};
