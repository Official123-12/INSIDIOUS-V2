const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "menu",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // ========== 🎯 REAL USERNAME FETCHER (English Only) ==========
            const userNumber = sender.split('@')[0];
            let userName = pushname?.trim() || '';
            
            if (!userName || userName === 'undefined') {
                try {
                    const contact = conn.contactStore?.contacts?.[sender] || await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || contact?.verifiedName || '';
                } catch {}
            }
            if (!userName || userName === 'undefined') {
                try {
                    const groupMetadata = from.endsWith('@g.us') ? await conn.groupMetadata(from) : null;
                    const participant = groupMetadata?.participants?.find(p => p.id === sender);
                    userName = participant?.name || '';
                } catch {}
            }
            userName = userName?.trim() || `User_${userNumber.slice(-4)}`;
            const userDisplay = `@${userNumber}`;
            const mentions = [sender];

            // ========== 📱 DEVICE COMPATIBILITY ==========
            const clientInfo = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '';
            const isOldClient = clientInfo.length < 2;
            const maxButtons = isOldClient ? 3 : 6;

            // ========== 🗂️ SCAN COMMANDS ==========
            const cmdPath = path.join(__dirname, '../../commands');
            const allCategories = fs.readdirSync(cmdPath).filter(cat => 
                fs.statSync(path.join(cmdPath, cat)).isDirectory()
            );

            let targetCategory = null;
            let targetPage = 0;
            if (args[0] === 'nav' && args[1] && args[2]) {
                targetCategory = args[1];
                targetPage = Math.max(0, parseInt(args[2]) || 0);
            }

            const categories = targetCategory ? [targetCategory] : allCategories;
            const cards = [];

            // ========== 🖼️ HEADER IMAGE ==========
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

            // ========== 🎨 PREMIUM BUTTON FACTORY ==========
            const createPremiumButton = (text, id, icon = '▸') => ({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `${icon} ${text}`,
                    id: `${config.prefix}${id.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`
                })
            });

            const createNavButton = (text, id, icon) => ({
                name: "quick_reply", 
                buttonParamsJson: JSON.stringify({
                    display_text: `${icon} ${text}`,
                    id: `${config.prefix}${id}`
                })
            });

            // ========== 🔄 BUILD CAROUSEL CARDS ==========
            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                let files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js') && f !== 'index.js')
                    .map(f => f.replace('.js', ''))
                    .sort();

                if (files.length === 0) continue;

                // 📏 DYNAMIC PAGINATION
                const buttonsPerPage = files.length <= 3 ? 3 : maxButtons;
                const pages = [];
                for (let i = 0; i < files.length; i += buttonsPerPage) {
                    pages.push(files.slice(i, i + buttonsPerPage));
                }

                const startPage = (targetCategory === cat) ? targetPage : 0;

                pages.forEach((pageFiles, pageIndex) => {
                    if (targetCategory === cat && pageIndex !== startPage) return;

                    // 🎨 PREMIUM BUTTONS with rotating icons
                    const buttons = pageFiles.map((cmd, idx) => {
                        const icons = ['⚡','🎯','🔧','✨','🚀','💎','🔥','🌟'];
                        const icon = icons[idx % icons.length];
                        return createPremiumButton(cmd, cmd, icon);
                    });

                    // 🧭 NAVIGATION
                    if (pages.length > 1) {
                        if (pageIndex > 0) {
                            buttons.push(createNavButton(`Back`, `nav ${cat} ${pageIndex - 1}`, '◀'));
                        }
                        if (pageIndex < pages.length - 1) {
                            buttons.push(createNavButton(`Next`, `nav ${cat} ${pageIndex + 1}`, '▶'));
                        }
                        buttons.push(createNavButton(`🏠 Home`, `menu`, '🏠'));
                    }

                    // 📏 DYNAMIC CARD HEIGHT
                    const paddingLines = pageFiles.length < 4 ? '\n\n' : '\n';
                    const categoryTitle = pages.length > 1 
                        ? `${cat.toUpperCase()} • Page ${pageIndex + 1}/${pages.length}`
                        : cat.toUpperCase();

                    // 💎 CARD BODY - ENGLISH ONLY
                    const cardBody = `╭━━━ ✦ ✦ ✦ ━━━╮
   ✨ ${categoryTitle}
╰━━━ ✦ ✦ ✦ ━━━╯${paddingLines}👤 ${userName} ${userDisplay}
📌 Select a command below:${paddingLines}`;

                    const card = {
                        body: { text: fancy(cardBody) },
                        footer: { 
                            text: fancy(`━━━ ✦ ✦ ✦ ━━━\n👑 Developer: ${config.developerName} • v2.2`) 
                        },
                        header: imageMedia ? {
                            hasMediaAttachment: true,
                            imageMessage: imageMedia.imageMessage
                        } : {
                            hasMediaAttachment: false,
                            title: fancy(`🤖 ${config.botName}`)
                        },
                        nativeFlowMessage: { buttons }
                    };
                    cards.push(card);
                });
            }

            // ========== 🎪 MAIN DASHBOARD ==========
            const stats = {
                cmds: cards.reduce((sum, c) => sum + (c.nativeFlowMessage?.buttons?.length || 0), 0),
                cats: categories.length,
                uptime: runtime(process.uptime())
            };

            const mainHeader = `╭━━━ ✦ INSIDIOUS ✦ ━━━╮
   👁 V2.2 • PREMIUM EDITION
╰━━━ ✦ ✦ ✦ ━━━╯

⚡ ${stats.cmds}+ Commands Available
📂 ${stats.cats} Categories
⏱️ Uptime: ${stats.uptime}

🔍 Tip: Type ${config.prefix}search <keyword>`;

            // ========== 📲 SEND INTERACTIVE MESSAGE ==========
            const interactiveMessage = {
                body: { text: fancy(mainHeader) },
                footer: { 
                    text: fancy(`🔄 Swipe ← → for more • ${config.prefix}help for guide`) 
                },
                header: {
                    title: fancy(`🌟 ${config.botName}`),
                    hasMediaAttachment: false,
                    subtitle: fancy('Premium WhatsApp Bot')
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
            console.error("❌ Menu Error:", e);
            
            // ========== 🆘 FALLBACK: UNIVERSAL TEXT MENU (ENGLISH) ==========
            const userNumber = sender.split('@')[0];
            let userName = pushname || `User_${userNumber.slice(-4)}`;
            try {
                const contact = await conn.getContact(sender);
                userName = contact?.name || contact?.pushname || userName;
            } catch {}

            let text = `╭━━━ ✦ INSIDIOUS ✦ ━━━╮
   📜 PREMIUM MENU • V2.2
╰━━━ ✦ ✦ ✦ ━━━╯

👤 ${userName} @${userNumber}
⏱️ Uptime: ${runtime(process.uptime())}

`;
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath).filter(cat => 
                fs.statSync(path.join(cmdPath, cat)).isDirectory()
            );
            
            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                const files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace('.js', ''));
                if (files.length) {
                    text += `✦ ${cat.toUpperCase()} [${files.length} commands]\n`;
                    text += files.map(cmd => `  ${config.prefix}${cmd}`).join('\n') + '\n\n';
                }
            }
            text += `━━━ ✦ ✦ ✦ ━━━
👑 Developer: ${config.developerName}
💡 Tip: Use ${config.prefix}search <command_name>`;
            
            await conn.sendMessage(from, { 
                text: fancy(text), 
                mentions: [sender] 
            }, { quoted: msg });
        }
    }
};

