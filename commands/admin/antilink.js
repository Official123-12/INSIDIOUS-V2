module.exports = {
    name: "antilink",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (!args[0]) return msg.reply(fancy("ᴜꜱᴀɢᴇ: .ᴀɴᴛɪʟɪɴᴋ ᴏɴ/ᴏꜰꜰ"));
        // Logic ipo kwenye handler.js tayari, hii ni toggle tu
        msg.reply(fancy(`ᴀɴᴛɪʟɪɴᴋ ɪꜱ ɴᴏᴡ: ${args[0].toUpperCase()}`));
    }
};
