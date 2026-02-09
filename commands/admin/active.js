module.exports = {
    name: "active",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        // Hii inahitaji data ya message counts kutoka MongoDB yako
        let txt = `╭── • 🥀 • ──╮\n  ${fancy("ᴀᴄᴛɪᴠɪᴛʏ ʀᴇᴘᴏʀᴛ")}\n╰── • 🥀 • ──╯\n\n`;
        txt += `🥀 *Top Members:* Active souls tracking...\n`;
        txt += `🥀 *Inactive:* Use .kickinactive to purge.\n\n${fancy(config.footer)}`;
        conn.sendMessage(from, { text: txt });
    }
};
