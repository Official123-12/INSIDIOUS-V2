const axios = require('axios');
module.exports = {
    name: "study",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ɪꜱ ʏᴏᴜʀ ǫᴜᴇꜱᴛɪᴏɴ?"));
        const res = await axios.get(`https://text.pollinations.ai/Act as a professor and solve this: ${args.join(' ')}`);
        conn.sendMessage(from, { text: fancy(`🥀 *ᴇᴅᴜᴄᴀᴛɪᴏɴ ᴀɪ:*\n\n${res.data}`) });
    }
};
