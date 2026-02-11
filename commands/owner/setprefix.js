const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "prefix",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;
        if (!args[0]) return msg.reply("🥀 Provide a character (e.g !, #, $)");
        config.prefix = args[0];
        msg.reply(fancy(`🥀 ᴘʀᴇꜰɪx ᴄʜᴀɴɢᴇᴅ ᴛᴏ: ${args[0]}`));
    }
};