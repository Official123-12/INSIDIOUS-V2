const config = require('../../config');
module.exports = {
    name: "aviator",
    execute: async (conn, msg, args, { from, fancy }) => {
        const companies = ['1win', 'betway', 'sportybet', 'premierbet', 'betika', 'wasafibet', '888sport', 'parimatch', '22bet', 'melbet', 'mozzart', 'mbet', 'meridianbet', 'gsb', 'bet365', 'megapari'];
        
        let selected = args[0]?.toLowerCase();
        if (!selected || !companies.includes(selected)) {
            return msg.reply(fancy(`🥀 ꜱᴇʟᴇᴄᴛ ᴄᴏᴍᴘᴀɴʏ: ${companies.join(', ')}`));
        }

        const odds = (Math.random() * (4.5 - 1.2) + 1.2).toFixed(2);
        const confidence = Math.floor(Math.random() * (99 - 85) + 85);

        let txt = `╭── • 🥀 • ──╮\n  ${fancy("ᴀᴠɪᴀᴛᴏʀ: " + selected.toUpperCase())}\n╰── • 🥀 • ──╯\n\n` +
            `🚀 *ᴇxᴘᴇᴄᴛᴇᴅ ʙᴜʀꜱᴛ:* ${odds}x\n` +
            `📊 *ᴄᴏɴꜰɪᴅᴇɴᴄᴇ:* ${confidence}%\n` +
            `🔔 *ꜱɪɢɴᴀʟ ᴛʏᴘᴇ:* ꜱᴀꜰᴇ ᴇxɪᴛ\n\n` +
            `🥀 *ꜱᴛʀᴀᴛᴇɢʏ:* ${fancy("ʙᴇᴛ ᴀꜰᴛᴇʀ ᴛᴡᴏ ʟᴏᴡ ʙʟᴜᴇꜱ (1.0x). ᴄᴀꜱʜ ᴏᴜᴛ ᴀᴛ ᴛᴀʀɢᴇᴛ.")}\n\n` +
            `${fancy("ᴅᴏ ɴᴏᴛ ᴛʀᴜꜱᴛ ᴛʜᴇ ᴘɪʟᴏᴛ, ᴛʀᴜꜱᴛ ᴛʜᴇ ꜱʜᴀᴅᴏᴡꜱ.")}`;

        conn.sendMessage(from, { 
            text: txt,
            contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ᴀᴠɪᴀᴛᴏʀ" } }
        });
    }
};
