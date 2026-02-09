const axios = require('axios');
module.exports = {
    name: "vuln",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜɪᴄʜ ꜱᴏꜰᴛᴡᴀʀᴇ/ᴄᴠᴇ?"));
        msg.reply(fancy("🥀 ꜱᴄᴀɴɴɪɴɢ ᴄᴠᴇ ᴅᴀᴛᴀʙᴀꜱᴇ..."));
        try {
            const res = await axios.get(`https://cve.circl.lu/api/last/5`); // Gets last 5 CVEs
            let txt = `╭── • 🥀 • ──╮\n  ${fancy("ᴠᴜʟɴᴇʀᴀʙɪʟɪᴛʏ ʀᴇᴘᴏʀᴛ")}\n╰── • 🥀 • ──╯\n\n`;
            res.data.slice(0, 3).forEach(v => {
                txt += `🥀 *ɪᴅ:* ${v.id}\n📖 *ꜱᴜᴍᴍᴀʀʏ:* ${v.summary.slice(0, 100)}...\n\n`;
            });
            conn.sendMessage(from, { text: fancy(txt) });
        } catch (e) { msg.reply("🥀 ᴅᴀᴛᴀʙᴀꜱᴇ ꜱᴇᴀʟᴇᴅ."); }
    }
};
