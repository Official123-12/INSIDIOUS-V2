module.exports = {
    name: "group",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (args[0] === 'open') {
            await conn.groupSettingUpdate(from, 'not_announcement');
            msg.reply(fancy("🥀 Group is now OPEN for all souls."));
        } else if (args[0] === 'close') {
            await conn.groupSettingUpdate(from, 'announcement');
            msg.reply(fancy("🥀 Group is now CLOSED. Only Admins can speak."));
        }
    }
};
