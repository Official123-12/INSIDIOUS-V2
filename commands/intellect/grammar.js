const axios = require('axios');
module.exports = {
    name: "grammar",
    execute: async (conn, msg, args, { from, fancy }) => {
        const text = args.join(' ') || (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation);
        if (!text) return msg.reply(fancy("ꜱᴇɴᴅ ᴛᴇxᴛ ᴛᴏ ᴄʜᴇᴄᴋ ɢʀᴀᴍᴍᴀʀ."));
        
        try {
            const res = await axios.get(`https://text.pollinations.ai/Check and correct the grammar, spelling, and punctuation of this text. List the mistakes found: ${text}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ɢʀᴀᴍᴍᴀʀ ᴄᴏʀʀᴇᴄᴛɪᴏɴ:*\n\n${res.data}`) }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ꜰᴀɪʟᴇᴅ ᴛᴏ ᴇᴅɪᴛ ᴛᴇxᴛ."); }
    }
};
