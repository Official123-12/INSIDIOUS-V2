const axios = require('axios');
module.exports = {
    name: "tiktok",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘᴀꜱᴛᴇ ᴛɪᴋᴛᴏᴋ ʟɪɴᴋ!"));
        try {
            const res = await axios.get(`https://ef-prime-md-ultra-apis.vercel.app/downloader/tkdl?=${args[0]}`);
            await conn.sendMessage(from, { 
                video: { url: res.data.result.video }, 
                caption: fancy("ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ ʙʏ ɪɴꜱɪᴅɪᴏᴜꜱ") 
            }, { quoted: msg });
        } catch (e) { msg.reply("ᴇʀʀᴏʀ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ."); }
    }
};
