const axios = require('axios');
module.exports = {
    name: "code",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄᴏᴅɪɴɢ ᴛᴀꜱᴋ (ᴇ.ɢ. ᴡʀɪᴛᴇ ᴀ ᴘʏᴛʜᴏɴ ʟᴏɢɪɴ ꜱᴄʀɪᴘᴛ)"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/You are a Senior Software Engineer. Provide clean, commented code for: ${args.join(' ')}`);
            await conn.sendMessage(from, { 
                text: `🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ᴄᴏᴅᴇ ʟᴀʙ:*\n\n\`\`\`${res.data}\`\`\``,
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴄᴏᴅɪɴɢ ᴇʀʀᴏʀ."); }
    }
};
