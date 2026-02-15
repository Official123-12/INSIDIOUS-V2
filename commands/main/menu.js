const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "menu",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // Get user's original WhatsApp name
            let userName = pushname;
            if (!userName) {
                try {
                    const contact = await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || sender.split('@')[0];
                } catch {
                    userName = sender.split('@')[0];
                }
            }

            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath);
            
            const cards = [];
            const BUTTONS_PER_PAGE = 6;

            // Prepare audio media (same audio for all cards)
            const audioUrl = config.menuAudio || 'https://example.com/intro.mp3'; // fallback
            let audioMedia;
            try {
                audioMedia = await prepareWAMessageMedia(
                    { audio: { url: audioUrl }, mimetype: 'audio/mpeg' },
                    { upload: conn.waUploadToServer }
                );
            } catch (e) {
                console.error('Failed to load audio:', e);
                audioMedia = null;
            }

            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                const stat = fs.statSync(catPath);
                if (!stat.isDirectory()) continue;
                
                let files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace('.js', ''));

                if (files.length === 0) continue;

                // Split files into pages
                const pages = [];
                for (let i = 0; i < files.length; i += BUTTONS_PER_PAGE) {
                    pages.push(files.slice(i, i + BUTTONS_PER_PAGE));
                }

                pages.forEach((pageFiles, pageIndex) => {
                    const buttons = pageFiles.map(cmd => ({
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: `${config.prefix}${cmd}`,
                            id: `${config.prefix}${cmd}`
                        })
                    }));

                    // Navigation buttons
                    if (pages.length > 1) {
                        if (pageIndex > 0) {
                            buttons.push({
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "◀️ Prev",
                                    id: `${config.prefix}nav ${cat} ${pageIndex - 1}`
                                })
                            });
                        }
                        if (pageIndex < pages.length - 1) {
                            buttons.push({
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "Next ▶️",
                                    id: `${config.prefix}nav ${cat} ${pageIndex + 1}`
                                })
                            });
                        }
                    }

                    // Build card with audio header if available
                    const card = {
                        body: { text: fancy(
                            `━━━━━━━━━━━━━━━━━━\n` +
                            `   🥀 *${cat.toUpperCase()} CATEGORY*${pages.length > 1 ? ` (Page ${pageIndex + 1}/${pages.length})` : ''}\n` +
                            `━━━━━━━━━━━━━━━━━━\n\n` +
                            `👋 Hello, *${userName}*!\n` +
                            `Select a command below.\n\n` +
                            `👑 Developer: ${config.developerName}`
                        ) },
                        footer: { text: fancy(config.footer) },
                        header: audioMedia ? {
                            hasMediaAttachment: true,
                            audioMessage: audioMedia.audioMessage
                        } : {
                            title: fancy(config.botName),
                            hasMediaAttachment: false
                        },
                        nativeFlowMessage: {
                            buttons: buttons
                        }
                    };
                    cards.push(card);
                });
            }

            // Main interactive message
            const interactiveMessage = {
                body: { text: fancy(
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `   👹 *INSIDIOUS V2.1.1*  \n` +
                    `━━━━━━━━━━━━━━━━━━\n\n` +
                    `⏱️ Uptime: ${runtime(process.uptime())}\n\n` +
                    `👤 User: *${userName}*`
                ) },
                footer: { text: fancy("◀️ Slide left/right for categories & pages ▶️") },
                header: {
                    title: fancy(config.botName),
                    hasMediaAttachment: false
                },
                carouselMessage: {
                    cards: cards
                }
            };

            // Send as regular interactive message
            const messageContent = { interactiveMessage };
            const waMessage = generateWAMessageFromContent(from, messageContent, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer
            });
            await conn.relayMessage(from, waMessage.message, { messageId: waMessage.key.id });

        } catch (e) {
            console.error("Menu error:", e);
            // Fallback plain text menu
            let text = `╭─── • 🥀 • ───╮\n`;
            text += `   *INSIDIOUS MENU*  \n`;
            text += `╰─── • 🥀 • ───╯\n\n`;
            text += `Hello ${pushname || sender.split('@')[0]},\n\n`;
            
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath);
            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                if (!fs.statSync(catPath).isDirectory()) continue;
                const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
                if (files.length) {
                    text += `*${cat.toUpperCase()}*\n`;
                    text += files.map(cmd => `${config.prefix}${cmd}`).join(', ') + '\n\n';
                }
            }
            text += `\n_Uptime: ${runtime(process.uptime())}_`;
            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
        }
    }
};