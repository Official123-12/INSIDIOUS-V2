const axios = require('axios');
module.exports = {
    name: "phish",
    execute: async (conn, msg, args, { from, fancy }) => {
        const platform = args[0] || "Facebook/Instagram";
        try {
            const res = await axios.get(`https://text.pollinations.ai/Explain how a phishing attack works for ${platform}. Include technical details about fake login pages and how to detect them. Respond in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴘʜɪꜱʜɪɴɢ ᴀᴡᴀʀᴇɴᴇꜱꜱ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ɪɴꜰᴏ ʟᴏꜱᴛ."); }
    }
};
