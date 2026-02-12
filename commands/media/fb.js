const axios = require('axios');
module.exports = {
    name: "fb",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘᴀꜱᴛᴇ ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ ʟɪɴᴋ!"));
        try {
            const res = await axios.get(`https://ef-prime-md-ultra-apis.vercel.app/downloader/fbdlv2?url=${args[0]}`);
            await conn.sendMessage(from, { 
                video: { url: res.data.result.hd }, 
                caption: fancy("🥀 *ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ*") 
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ꜰʙ ᴠɪᴅᴇᴏ."); }
    }
};
