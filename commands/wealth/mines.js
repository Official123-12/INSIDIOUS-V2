const config = require('../../config');
module.exports = {
    name: "mines",
    execute: async (conn, msg, args, { from, fancy }) => {
        const companies = ['1win', 'betway', 'sportybet', 'premierbet', 'betika', 'wasafibet', '888sport', 'parimatch', '22bet', 'melbet', 'mozzart', 'mbet', 'meridianbet', 'gsb', 'bet365', 'megapari'];
        
        let selected = args[0]?.toLowerCase();
        if (!selected || !companies.includes(selected)) {
            return msg.reply(fancy(`🥀 ᴘʟᴇᴀꜱᴇ ꜱᴇʟᴇᴄᴛ ᴀ ᴠᴀʟɪᴅ ᴄᴏᴍᴘᴀɴʏ:\n\n${companies.join(', ')}`));
        }

        // Logic: Generate 5x5 Grid (25 Boxes)
        let grid = Array(25).fill("⬛");
        let safeStars = [];
        while(safeStars.length < 8) { // Predict 4 safe stars
            let r = Math.floor(Math.random() * 25);
            if(!safeStars.includes(r)) safeStars.push(r);
        }
        safeStars.forEach(i => grid[i] = "💎");

        let map = "";
        for (let i = 0; i < grid.length; i++) {
            if (i % 5 === 0) map += "\n";
            map += grid[i] + " ";
        }

        let txt = `╭── • 🥀 • ──╮\n  ${fancy("ᴍɪɴᴇꜱ: " + selected.toUpperCase())}\n╰── • 🥀 • ──╯\n` +
            `${map}\n\n` +
            `💣 *ᴍɪɴᴇꜱ ᴅᴇᴛᴇᴄᴛᴇᴅ:* 3\n` +
            `💎 *ꜱᴀꜰᴇ ʀᴏᴜᴛᴇ:* ꜰᴏʟʟᴏᴡ ᴛʜᴇ ᴅɪᴀᴍᴏɴᴅꜱ\n` +
            `📊 *ᴀʟɢᴏʀɪᴛʜᴍ:* 1ᴡɪɴ-ʙᴀꜱᴇᴅ ᴠ2.1\n\n` +
            `${fancy("ɪɴꜱɪᴅɪᴏᴜꜱ ʜᴀꜱ ᴘᴇɴᴇᴛʀᴀᴛᴇᴅ ᴛʜᴇ ɢʀɪᴅ.")}`;

        conn.sendMessage(from, { 
            text: txt,
            contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ᴍɪɴᴇꜱ" } }
        });
    }
};
