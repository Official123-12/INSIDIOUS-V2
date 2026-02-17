const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');

module.exports = {
    name: "menu",
    execute: async (conn, msg, args, { from, pushname }) => {
        try {
            // 1. Ionekane bot inaandika (Typing...)
            await conn.sendPresenceUpdate('composing', from);

            // 2. Njia ya kuelekea kwenye folder la commands
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath);
            let totalCmds = 0;
            
            // 3. Header ya Menu (Premium Horror Style)
            let menuTxt = `╭── • 🥀 • ──╮\n  ${fancy(config.botName)}\n╰── • 🥀 • ──╯\n\n`;
            menuTxt += `│ ◦ ${fancy("ꜱᴏᴜʟ")}: ${pushname}\n`;
            menuTxt += `│ ◦ ${fancy("ᴏᴡɴᴇʀ")}: ${config.ownerName}\n`;
            menuTxt += `│ ◦ ${fancy("ᴜᴘᴛɪᴍᴇ")}: ${runtime(process.uptime())}\n`;
            menuTxt += `│ ◦ ${fancy("ᴍᴏᴅᴇ")}: ${config.workMode.toUpperCase()}\n`;
            menuTxt += `│ ◦ ${fancy("ᴘʀᴇꜰɪx")}: ${config.prefix}\n\n`;

            // 4. Kupitia kila sub-folder na kupanga commands KWA WIMA
            categories.forEach(cat => {
                const catPath = path.join(cmdPath, cat);
                // Hakikisha ni folder kweli
                if (fs.statSync(catPath).isDirectory()) {
                    const files = fs.readdirSync(catPath)
                        .filter(f => f.endsWith('.js'))
                        .map(f => f.replace('.js', ''));
                    
                    if (files.length > 0) {
                        totalCmds += files.length;
                        menuTxt += `🥀 *${fancy(cat.toUpperCase())}*\n`;
                        
                        // Kupanga commands kwa wima
                        files.forEach(file => {
                            menuTxt += `│ ◦ ${file}\n`;
                        });
                        menuTxt += `│\n`; // Nafasi baada ya kila category
                    }
                }
            });

            menuTxt += `│ ◦ ${fancy("ᴛᴏᴛᴀʟ ᴄᴍᴅꜱ")}: ${totalCmds}\n`;
            menuTxt += `└──────────────\n${fancy(config.footer)}`;

            // 5. Tuma Menu kwa kutumia picha na Branding ya Newsletter
            await conn.sendMessage(from, { 
                image: { url: config.menuImage }, 
                caption: menuTxt,
                contextInfo: { 
                    isForwarded: true, 
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: { 
                        newsletterJid: config.newsletterJid, 
                        newsletterName: config.botName,
                        serverMessageId: 100
                    }
                } 
            }, { quoted: msg });

        } catch (e) {
            console.error(e);
            msg.reply(fancy("🥀 Shadows failed to summon the menu. Check folder structure."));
        }
    }
};