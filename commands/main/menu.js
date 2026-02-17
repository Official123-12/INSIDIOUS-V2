const fs = require('fs-extra');
const path = require('path');
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = require("@whiskeysockets/baileys");
const { fancy, runtime } = require('../../lib/tools');
const handler = require('../../handler');

module.exports = {
    name: "menu",
    aliases: ["help", "commands"],
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            let userName = pushname || sender.split('@')[0];
            const settings = await handler.loadGlobalSettings();
            const prefix = settings.prefix || '.';

            const cmdPath = path.join(__dirname, '../');
            const categories = fs.readdirSync(cmdPath).filter(c => fs.statSync(path.join(cmdPath, c)).isDirectory());
            const cards = [];

            // Prepare image media (same for all cards)
            let imageMedia = null;
            if (settings.menuImage) {
                try {
                    const imgSrc = settings.menuImage.startsWith('http') ? { url: settings.menuImage } : { url: settings.menuImage };
                    imageMedia = await prepareWAMessageMedia({ image: imgSrc }, { upload: conn.waUploadToServer || conn.upload });
                } catch (e) { console.error("Menu image error:", e); }
            }

            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
                if (files.length === 0) continue;

                // Split files into pages (max 4 buttons per page for better UX)
                const perPage = 4;
                const pages = [];
                for (let i = 0; i < files.length; i += perPage) pages.push(files.slice(i, i + perPage));

                pages.forEach((pageFiles, idx) => {
                    // Create buttons for each command on this page
                    const buttons = pageFiles.map(cmd => ({
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: `${prefix}${cmd}`,
                            id: `${prefix}${cmd}`
                        })
                    }));

                    // Navigation buttons if multiple pages
                    if (pages.length > 1) {
                        if (idx > 0) {
                            buttons.push({
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "◀️ Prev",
                                    id: `${prefix}menu ${cat} ${idx-1}`
                                })
                            });
                        }
                        if (idx < pages.length-1) {
                            buttons.push({
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "Next ▶️",
                                    id: `${prefix}menu ${cat} ${idx+1}`
                                })
                            });
                        }
                    }

                    // Card header (image or title)
                    const cardHeader = imageMedia ? { imageMessage: imageMedia.imageMessage } : { title: fancy(cat.toUpperCase()) };

                    const cardBody = `╭─── • 🥀 • ───╮\n` +
                                     `   *${cat.toUpperCase()}*   \n` +
                                     `╰─── • 🥀 • ───╯\n\n` +
                                     `👋 Hello, *${userName}*\n` +
                                     `Page ${idx+1}/${pages.length}\n` +
                                     `Select a command below.`;

                    const card = {
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: fancy(cardBody)
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: fancy(settings.footer)
                        }),
                        header: cardHeader,
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: buttons
                        })
                    };
                    cards.push(card);
                });
            }

            const mainHeader = `╭─── • 🥀 • ───╮\n` +
                               `   *INSIDIOUS MENU*   \n` +
                               `╰─── • 🥀 • ───╯\n\n` +
                               `Uptime: ${runtime(process.uptime())}\n` +
                               `👤 User: ${userName}\n\n` +
                               `◀️ Swipe to explore categories ▶️`;

            const interactiveMsg = {
                body: proto.Message.InteractiveMessage.Body.fromObject({
                    text: fancy(mainHeader)
                }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({
                    text: fancy("STANYTZ AUTOMATION")
                }),
                carouselMessage: proto.Message.CarouselMessage.fromObject({
                    cards: cards
                }),
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: settings.newsletterJid || "120363404317544295@newsletter",
                        newsletterName: settings.botName
                    }
                }
            };

            const msgContent = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: interactiveMsg
                    }
                }
            }, { userJid: conn.user.id, upload: conn.waUploadToServer });

            await conn.relayMessage(from, msgContent.message, { messageId: msgContent.key.id });

        } catch (e) {
            console.error("Menu error:", e);
            await msg.reply("❌ Menu error. Check console.");
        }
    }
};