const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: "spotify",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴘᴏᴛɪꜰʏ ʟɪɴᴋ ᴏʀ ꜱᴏɴɢ ɴᴀᴍᴇ!"));
        msg.reply(fancy("🥀 ᴘᴇɴᴇᴛʀᴀᴛɪɴɢ ꜱᴘᴏᴛɪꜰʏ ᴀʀᴄʜɪᴠᴇꜱ..."));
        try {
            const res = await axios.get(`https://api.darlyn.my.id/api/spotify?url=${encodeURIComponent(args.join(' '))}`);
            const data = res.data.result;
            await conn.sendMessage(from, { 
                audio: { url: data.download }, 
                mimetype: 'audio/mp4',
                contextInfo: { 
                    externalAdReply: { 
                        title: data.title, 
                        body: data.artist, 
                        mediaType: 1, 
                        thumbnailUrl: data.thumbnail,
                        renderLargerThumbnail: true
                    }
                } 
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ꜱᴘᴏᴛɪꜰʏ ꜱᴇʀᴠᴇʀ ɪꜱ ɢʜᴏꜱᴛᴇᴅ."); }
    }
};
