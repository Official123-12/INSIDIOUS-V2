module.exports = {
    name: "kick",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        if (!user) return msg.reply("🥀 Tag the soul to banish.");
        await conn.groupParticipantsUpdate(from, [user], "remove");
        conn.sendMessage(from, { text: fancy("🥀 User exiled to the further.") });
    }
};
