/**
 * 🚀 INSIDIOUS NEXUS • COMMAND CENTER V2.2
 * 🎨 THEME: FUTURISTIC TECH DASHBOARD (CYAN/BLUE)
 * ⚡ FEATURES: Live Stats • Quick Actions • Category Hub • Premium Showcase
 * 🇬🇧 LANGUAGE: English Only • Premium International Standard
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const os = require('os');

module.exports = {
    name: "menu3",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // ========== 🎯 REAL USERNAME ==========
            const userNumber = sender.split('@')[0];
            let userName = pushname?.trim() || '';
            if (!userName || userName === 'undefined') {
                try {
                    const contact = conn.contactStore?.contacts?.[sender] || await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || contact?.verifiedName || '';
                } catch {}
            }
            userName = userName?.trim() || `User_${userNumber.slice(-4)}`;
            const mentions = [sender];

            // ========== 📱 DEVICE CHECK ==========
            const clientInfo = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '';
            const isOldClient = clientInfo.length < 2;

            // ========== 📊 LIVE SYSTEM STATS ==========
            const uptimeSeconds = process.uptime();
            const uptimeStr = runtime(uptimeSeconds);
            const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const ramTotal = (os.totalmem() / 1024 / 1024).toFixed(2);
            const ramPercent = ((ramUsage / ramTotal) * 100).toFixed(1);
            const cpuCores = os.cpus().length;
            const platform = os.platform();

            // ========== 🗂️ SCAN CATEGORIES ==========
            const cmdPath = path.join(__dirname, '../../commands');
            const allCategories = fs.readdirSync(cmdPath).filter(cat => 
                fs.statSync(path.join(cmdPath, cat)).isDirectory()
            );

            const categoryStats = {};
            let totalCommands = 0;
            for (const cat of allCategories) {
                const catPath = path.join(cmdPath, cat);
                const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js') && f !== 'index.js');
                categoryStats[cat] = files.length;
                totalCommands += files.length;
            }

            // ========== 🎨 PREMIUM BUTTON FACTORY ==========
            const createNexusButton = (text, id, icon) => ({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `${icon} ${text}`,
                    id: `${config.prefix}${id.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`
                })
            });

            // ========== 🖼️ HEADER IMAGE (NEXUS STYLE) ==========
            let imageMedia = null;
            if (config.menuImage && !isOldClient) {
                try {
                    imageMedia = await prepareWAMessageMedia(
                        { image: { url: config.menuImage } },
                        { upload: conn.waUploadToServer }
                    );
                } catch (e) {
                    console.warn("⚠️ Menu image skipped:", e.message);
                }
            }

            // ========== 🎪 BUILD DASHBOARD CARDS ==========
            const cards = [];

            // ─────────────────────────────────────────────
            // CARD 1: 📊 SYSTEM DASHBOARD
            // ─────────────────────────────────────────────
            const dashboardBody = `╭━━━━━━━━━━━━━━━━━━╮
   🚀 NEXUS DASHBOARD
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName} (@${userNumber})

┌─── 📊 SYSTEM STATUS ───
│ ⚡ RAM: ${ramUsage}MB / ${ramTotal}MB (${ramPercent}%)
│ 🖥️ CPU: ${cpuCores} Cores
│ 💾 Platform: ${platform}
│ ⏱️ Uptime: ${uptimeStr}
│ 📦 Commands: ${totalCommands}
│ 📂 Categories: ${allCategories.length}
└────────────────────

💡 Tip: Use ${config.prefix}stats for details`;

            cards.push({
                body: { text: fancy(dashboardBody) },
                footer: { text: fancy(`━━━ 🚀 ━━━\n👑 ${config.developerName} • Nexus V2.2`) },
                header: imageMedia ? {
                    hasMediaAttachment: true,
                    imageMessage: imageMedia.imageMessage
                } : {
                    hasMediaAttachment: false,
                    title: fancy(`🚀 ${config.botName}`)
                },
                nativeFlowMessage: {
                    buttons: [
                        createNexusButton('Refresh', 'menu3', '🔄'),
                        createNexusButton('📊 Full Stats', 'stats', '📈'),
                        createNexusButton('🏠 Main Menu', 'menu', '🏠')
                    ]
                }
            });

            // ─────────────────────────────────────────────
            // CARD 2: ⚡ QUICK ACTIONS (TOP COMMANDS)
            // ─────────────────────────────────────────────
            const quickCommands = ['menu', 'search', 'ping', 'owner', 'status'];
            const quickButtons = quickCommands.map(cmd => 
                createNexusButton(cmd.toUpperCase(), cmd, '⚡')
            );
            quickButtons.push(createNexusButton('🏠 Main Menu', 'menu', '🏠'));

            const quickBody = `╭━━━━━━━━━━━━━━━━━━╮
   ⚡ QUICK ACTIONS
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName}

📌 One-tap access to frequently used commands:

• Fast execution
• No typing needed
• Instant results

💡 More commands in main menu`;

            cards.push({
                body: { text: fancy(quickBody) },
                footer: { text: fancy(`━━━ ⚡ ━━━\n🚀 Nexus Speed Boost`) },
                header: {
                    hasMediaAttachment: false,
                    title: fancy(`⚡ SPEED HUB`)
                },
                nativeFlowMessage: { buttons: quickButtons }
            });

            // ─────────────────────────────────────────────
            // CARD 3: 🗂️ CATEGORY HUB
            // ─────────────────────────────────────────────
            const categoryButtons = allCategories.slice(0, 5).map(cat => 
                createNexusButton(`${cat} (${categoryStats[cat]})`, `menu nav ${cat} 0`, '📁')
            );
            categoryButtons.push(createNexusButton('🏠 Main Menu', 'menu', '🏠'));

            const categoryBody = `╭━━━━━━━━━━━━━━━━━━╮
   🗂️ CATEGORY HUB
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName}

📂 Browse by category:

${allCategories.slice(0, 5).map((cat, i) => `   ${i+1}. ${cat} (${categoryStats[cat]} cmds)`).join('\n')}

${allCategories.length > 5 ? `\n📌 ${allCategories.length - 5} more in main menu` : ''}

💡 Tap any category to explore`;

            cards.push({
                body: { text: fancy(categoryBody) },
                footer: { text: fancy(`━━━ 🗂️ ━━━\n📂 ${allCategories.length} Total Categories`) },
                header: {
                    hasMediaAttachment: false,
                    title: fancy(`🗂️ BROWSE`)
                },
                nativeFlowMessage: { buttons: categoryButtons }
            });

            // ─────────────────────────────────────────────
            // CARD 4: 💎 PREMIUM FEATURES
            // ─────────────────────────────────────────────
            const premiumButtons = [
                createNexusButton('✨ Features', 'features', '💎'),
                createNexusButton('👑 VIP Access', 'vip', '🔑'),
                createNexusButton('📞 Support', 'support', '🆘'),
                createNexusButton('🏠 Main Menu', 'menu', '🏠')
            ];

            const premiumBody = `╭━━━━━━━━━━━━━━━━━━╮
   💎 PREMIUM HUB
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName}

🌟 INSIDIOUS Premium Features:

✓ Advanced Automation
✓ Multi-Device Support
✓ Custom Commands
✓ Priority Support
✓ Exclusive Plugins
✓ Daily Updates

🔓 Upgrade for full access`;

            cards.push({
                body: { text: fancy(premiumBody) },
                footer: { text: fancy(`━━━ 💎 ━━━\n👑 ${config.developerName} Industries`) },
                header: {
                    hasMediaAttachment: false,
                    title: fancy(`💎 PREMIUM`)
                },
                nativeFlowMessage: { buttons: premiumButtons }
            });

            // ─────────────────────────────────────────────
            // CARD 5: 🆘 HELP & SUPPORT
            // ─────────────────────────────────────────────
            const helpButtons = [
                createNexusButton('❓ How To Use', 'help', '📖'),
                createNexusButton('🔍 Search', 'search', '🔎'),
                createNexusButton('⚙️ Settings', 'settings', '⚙️'),
                createNexusButton('📞 Contact Dev', 'owner', '👤'),
                createNexusButton('🏠 Main Menu', 'menu', '🏠')
            ];

            const helpBody = `╭━━━━━━━━━━━━━━━━━━╮
   🆘 HELP CENTER
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName}

📚 Quick Help:

• ${config.prefix}menu - Full command list
• ${config.prefix}search - Find commands
• ${config.prefix}help - Usage guide
• ${config.prefix}owner - Contact developer

💬 We're here to help 24/7`;

            cards.push({
                body: { text: fancy(helpBody) },
                footer: { text: fancy(`━━━ 🆘 ━━━\n📞 Support: ${config.developerName}`) },
                header: {
                    hasMediaAttachment: false,
                    title: fancy(`🆘 SUPPORT`)
                },
                nativeFlowMessage: { buttons: helpButtons }
            });

            // ========== 📲 SEND INTERACTIVE MESSAGE ==========
            const mainHeader = `╭━━━━━━━━━━━━━━━━━━╮
   🚀 INSIDIOUS NEXUS
╰━━━━━━━━━━━━━━━━━━╯

🎯 Command Center V2.2

⚡ ${totalCommands} Commands
📂 ${allCategories.length} Categories
💾 ${ramPercent}% RAM Usage
⏱️ ${uptimeStr} Uptime

🔄 Swipe ← → for more panels`;

            const interactiveMessage = {
                body: { text: fancy(mainHeader) },
                footer: { text: fancy(`🚀 Next-Gen Dashboard • ${config.prefix}help for guide`) },
                header: {
                    title: fancy(`🚀 ${config.botName}`),
                    hasMediaAttachment: false,
                    subtitle: fancy('Nexus Command Center')
                },
                carouselMessage: {
                    cards: cards,
                    messageVersion: 1
                }
            };

            const messageContent = { interactiveMessage };
            const waMessage = generateWAMessageFromContent(from, messageContent, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer
            });
            
            await conn.relayMessage(from, waMessage.message, { 
                messageId: waMessage.key.id, 
                mentions 
            });

        } catch (e) {
            console.error("❌ Menu3 Error:", e);
            
            // ========== 🆘 FALLBACK: TEXT DASHBOARD ==========
            const userNumber = sender.split('@')[0];
            let userName = pushname || `User_${userNumber.slice(-4)}`;
            try {
                const contact = await conn.getContact(sender);
                userName = contact?.name || contact?.pushname || userName;
            } catch {}

            const uptimeStr = runtime(process.uptime());
            const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

            let text = `╭━━━━━━━━━━━━━━━━━━╮\n   🚀 INSIDIOUS NEXUS\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 ${userName} (@${userNumber})\n\n`;
            text += `┌─── 📊 SYSTEM ───\n`;
            text += `│ ⏱️ Uptime: ${uptimeStr}\n`;
            text += `│ 💾 RAM: ${ramUsage}MB\n`;
            text += `│ 📦 Commands: Available\n`;
            text += `└─────────────────\n\n`;
            text += `⚡ Quick Actions:\n`;
            text += `  ${config.prefix}menu • ${config.prefix}search • ${config.prefix}help\n\n`;
            text += `━━━ 🚀 ━━━\n👑 ${config.developerName} Industries`;
            
            await conn.sendMessage(from, { text: fancy(text), mentions: [sender] }, { quoted: msg });
        }
    }
};

