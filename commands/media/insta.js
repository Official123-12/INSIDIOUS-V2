const axios = require('axios');
module.exports = {
    name: "insta",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘᴀꜱᴛᴇ ɪɴꜱᴛᴀɢʀᴀᴍ ʟɪɴᴋ!"));
        try {
            const res = await axios.get(`https://ef-prime-md-ultra-apis.vercel.app/downloader/ig-dl?url=${args[0]}`);
            await conn.sendMessage(from, { 
                video: { url: res.data.result[0].url }, 
                caption: fancy("🥀 *ɪɴꜱᴛᴀɢʀᴀᴍ ʀᴇᴇʟ ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ*") 
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ɪɴꜱᴛᴀ ʀᴇᴇʟ."); }
    }
};
