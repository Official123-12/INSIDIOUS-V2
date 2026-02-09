const fs = require('fs-extra');
const config = require('../../config');
const { runtime } = require('../../lib/font');

module.exports = {
    name: "menu",
    execute: async (conn, msg, args, { from, fancy }) => {
        const categories = fs.readdirSync('./commands');
        let total = 0;
        categories.forEach(c => total += fs.readdirSync(`./commands/${c}`).length);

        let menu = `╭── • 🥀 • ──╮\n  ${fancy(config.botName)}\n╰── • 🥀 • ──╯\n\n`;
        menu += `│ ◦ ${fancy("ᴏᴡɴᴇʀ")}: ${config.ownerName}\n`;
        menu += `│ ◦ ${fancy("ᴜᴘᴛɪᴍᴇ")}: ${runtime(process.uptime())}\n`;
        menu += `│ ◦ ${fancy("ᴄᴍᴅꜱ")}: ${total}\n\n`;

        categories.forEach(cat => {
            const files = fs.readdirSync(`./commands/${cat}`).map(f => f.replace('.js', ''));
            menu += `🥀 *${fancy(cat.toUpperCase())}*\n│ ◦ ${files.join(', ')}\n\n`;
        });

        menu += `└──────────────\n${fancy(config.footer)}`;
        
        await conn.sendMessage(from, { 
            text: menu,
            contextInfo: { 
                isForwarded: true, 
                forwardedNewsletterMessageInfo: { 
                    newsletterJid: config.newsletterJid, 
                    newsletterName: config.botName 
                } 
            }
        }, { quoted: msg });
    }
};
