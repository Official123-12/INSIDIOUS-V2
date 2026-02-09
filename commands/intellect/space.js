const axios = require('axios');
module.exports = {
    name: "space",
    execute: async (conn, msg, args, { from, fancy }) => {
        const topic = args[0] ? args.join(' ') : "The Black Holes and Multi-universe theory";
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as an Astrophysicist. Explain clearly the wonders of: ${topic}. Respond in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴄᴏꜱᴍɪᴄ ɪɴᴛᴇʟʟᴇᴄᴛ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ʟᴏꜱᴛ ɪɴ ᴛʜᴇ ᴠᴏɪᴅ."); }
    }
};
