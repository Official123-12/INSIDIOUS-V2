const axios = require('axios');
module.exports = {
    name: "portscan",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴛᴀʀɢᴇᴛ ᴛᴏ ꜱᴄᴀɴ."));
        msg.reply(fancy("🥀 ᴘᴇɴᴇᴛʀᴀᴛɪɴɢ ᴛʜᴇ ꜰɪʀᴇᴡᴀʟʟ..."));
        try {
            const res = await axios.get(`https://api.hackertarget.com/nmap/?q=${args[0]}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ɴᴍᴀᴘ ꜱᴄᴀɴ ʀᴇꜱᴜʟᴛꜱ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ꜱᴄᴀɴ ꜰᴀɪʟᴇᴅ. ᴛᴀʀɢᴇᴛ ꜱᴇᴄᴜʀᴇᴅ."); }
    }
};
