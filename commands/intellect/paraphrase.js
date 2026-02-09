const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: "paraphrase",
    execute: async (conn, msg, args, { from, fancy }) => {
        const text = args.join(' ') || (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation);
        if (!text) return msg.reply(fancy("ᴘᴀꜱᴛᴇ ᴛᴇxᴛ ᴛᴏ ᴘᴀʀᴀᴘʜʀᴀꜱᴇ."));
        
        msg.reply(fancy("🥀 ʀᴇᴡʀɪᴛɪɴɢ ᴛʜᴇ ꜱᴄʀᴏʟʟꜱ..."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Rewrite the following text professionally to avoid plagiarism while maintaining the original meaning. Use high-level academic vocabulary: ${text}`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ᴘᴀʀᴀᴘʜʀᴀꜱᴇ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ᴀᴄᴀᴅᴇᴍɪᴀ" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴇʀʀᴏʀ ɪɴ ᴘᴀʀᴀᴘʜʀᴀꜱɪɴɢ."); }
    }
};
