module.exports = {
    name: "getstatus",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage) return msg.reply(fancy("ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴇᴡ-ᴏɴᴄᴇ ᴏʀ ꜱᴛᴀᴛᴜꜱ!"));
        let quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        await conn.sendMessage(conn.user.id, { forward: quoted });
        msg.reply(fancy("ᴍᴇᴅɪᴀ ʜᴀꜱ ʙᴇᴇɴ ᴄᴀᴜɢʜᴛ. ᴄʜᴇᴄᴋ ʏᴏᴜʀ ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ."));
    }
};
