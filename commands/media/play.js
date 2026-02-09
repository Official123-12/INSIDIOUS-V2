const axios = require('axios');
module.exports = {
    name: "play",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴇɴᴛᴇʀ ꜱᴏɴɢ ɴᴀᴍᴇ!"));
        msg.reply(fancy("🥀 ꜱᴇᴀʀᴄʜɪɴɢ ɪɴ ᴛʜᴇ ꜰᴜʀᴛʜᴇʀ..."));
        try {
            // Using a generic scraper API for YouTube
            const res = await axios.get(`https://api.darlyn.my.id/api/ytmp3?url=${args.join(' ')}`);
            await conn.sendMessage(from, { audio: { url: res.data.result.url }, mimetype: 'audio/mp4' }, { quoted: msg });
        } catch (e) { msg.reply("ᴄᴏᴜʟᴅ ɴᴏᴛ ʀᴇᴛʀɪᴇᴠᴇ ᴛʜᴇ ꜱᴏᴜʟ ᴏꜰ ᴛʜɪꜱ ᴍᴜꜱɪᴄ."); }
    }
};
