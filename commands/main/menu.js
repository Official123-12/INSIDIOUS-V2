const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/font');

module.exports = {
    name: "menu",
    execute: async (conn, msg, args, { from }) => {
        try {
            await conn.sendPresenceUpdate('composing', from);

            // 1. Hesabu ya Commands
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath);
            let totalCmds = 0;
            categories.forEach(cat => {
                totalCmds += fs.readdirSync(path.join(cmdPath, cat)).filter(f => f.endsWith('.js')).length;
            });

            // 2. Header ya Menu
            let menu = `╭── • 🥀 • ──╮\n  ${fancy(config.botName)}\n╰── • 🥀 • ──╯\n\n`;
            menu += `│ ◦ ${fancy("ᴏᴡɴᴇʀ")}: ${config.ownerName}\n`;
            menu += `│ ◦ ${fancy("ᴜᴘᴛɪᴍᴇ")}: ${runtime(process.uptime())}\n`;
            menu += `│ ◦ ${fancy("ᴍᴏᴅᴇ")}: ${config.workMode.toUpperCase()}\n`;
            menu += `│ ◦ ${fancy("ᴄᴍᴅꜱ")}: ${totalCmds}\n\n`;

            // 3. Loop ya Categories - COMMANDS WIMA
            categories.forEach(cat => {
                const files = fs.readdirSync(path.join(cmdPath, cat))
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace('.js', ''));
                
                menu += `🥀 *${fancy(cat.toUpperCase())}*\n`;
                
                // COMMANDS WIMA - Kila command kwa line yake
                files.forEach(file => {
                    menu += `│ ◦ ${file}\n`;
                });
                menu += `\n`;
            });

            // 4. Features List
            menu += `🥀 *${fancy("ACTIVE FEATURES")}*\n`;
            menu += `│ ◦ 🔗 Anti Link (Admin Only)\n`;
            menu += `│ ◦ 🚫 Anti Porn (Admin Only)\n`;
            menu += `│ ◦ ⚠️ Anti Scam (Admin Only)\n`;
            menu += `│ ◦ 📷 Anti Media (Admin Only)\n`;
            menu += `│ ◦ #️⃣ Anti Tag (Admin Only)\n`;
            menu += `│ ◦ 👁️ Anti View Once\n`;
            menu += `│ ◦ 🗑️ Anti Delete\n`;
            menu += `│ ◦ 💤 Sleeping Mode\n`;
            menu += `│ ◦ 🎉 Welcome/Goodbye\n`;
            menu += `│ ◦ 📊 Active Members\n`;
            menu += `│ ◦ 🤖 AI Chatbot\n`;
            menu += `│ ◦ 👀 Auto Read\n`;
            menu += `│ ◦ ❤️ Auto React\n`;
            menu += `│ ◦ 📼 Auto Recording\n`;
            menu += `│ ◦ 💾 Auto Save\n`;
            menu += `│ ◦ 📞 Anti Call\n`;
            menu += `│ ◦ 📥 Download Status\n`;
            menu += `│ ◦ 🚫 Anti Spam\n`;
            menu += `│ ◦ 🐛 Anti Bug\n`;
            menu += `\n`;

            menu += `└──────────────\n${fancy(config.footer)}`;

            // 5. Tuma kwa Branding ya Newsletter
            await conn.sendMessage(from, { 
                image: { url: config.menuImage }, 
                caption: menu,
                contextInfo: { 
                    isForwarded: true, 
                    forwardedNewsletterMessageInfo: { 
                        newsletterJid: config.newsletterJid, 
                        newsletterName: config.botName 
                    } 
                }
            }, { quoted: msg });

        } catch (e) {
            console.error("Menu error:", e);
            try {
                await conn.sendMessage(from, { text: fancy("Error summoning the menu...") }, { quoted: msg });
            } catch (e2) {}
        }
    }
};
