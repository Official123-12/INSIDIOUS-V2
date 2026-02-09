const config = require('../../config');
module.exports = {
    name: "alive",
    execute: async (conn, msg, args, { from, fancy }) => {
        const aliveTxt = `╭── • 🥀 • ──╮\n  ${fancy(config.botName)}\n╰── • 🥀 • ──╯\n\n│ ◦ ꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ\n│ ◦ ᴅᴇᴠ: ${config.ownerName}\n│ ◦ ᴠᴇʀꜱɪᴏɴ: 2.1.1\n└──────────────`;
        await conn.sendMessage(from, { 
            image: { url: "https://files.catbox.moe/horror-insidious.jpg" }, 
            caption: aliveTxt 
        });
    }
};
