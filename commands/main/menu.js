const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "menu",
    execute: async (conn, msg, args, { from, pushname }) => {
        try {
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath);
            
            const cards = [];

            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                const stat = fs.statSync(catPath);
                if (!stat.isDirectory()) continue;
                
                const files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace('.js', ''));

                if (files.length === 0) continue;

                // Create buttons for each command
                const buttons = files.map(cmd => ({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `${config.prefix}${cmd}`,
                        id: `${config.prefix}${cmd}`
                    })
                }));

                // Prepare image media for this card
                const imageMedia = await prepareWAMessageMedia(
                    { image: { url: config.menuImage } },
                    { upload: conn.waUploadToServer }
                );

                // Build card using Proto objects correctly
                const card = {
                    body: { text: fancy(`🥀 *${cat.toUpperCase()} CATEGORY*\n\nHello ${pushname},\nSelect a command below.\n\nDev: ${config.developerName}`) },
                    footer: { text: fancy(config.footer) },
                    header: {
                        hasMediaAttachment: true,
                        imageMessage: imageMedia.imageMessage
                    },
                    nativeFlowMessage: {
                        buttons: buttons
                    }
                };
                cards.push(card);
            }

            // Main interactive message structure
            const interactiveMessage = {
                body: { text: fancy(`👹 INSIDIOUS V2.1.1 DASHBOARD\nUptime: ${runtime(process.uptime())}`) },
                footer: { text: fancy("Slide left/right for more categories") },
                header: {
                    title: fancy(config.botName),
                    hasMediaAttachment: false
                },
                carouselMessage: {
                    cards: cards
                }
            };

            // Wrap in viewOnceMessage (makes it disappear after viewing)
            const viewOnceMessage = {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: interactiveMessage
                    }
                }
            };

            // Generate and send the message
            const waMessage = generateWAMessageFromContent(from, viewOnceMessage, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer
            });
            await conn.relayMessage(from, waMessage.message, { messageId: waMessage.key.id });

        } catch (e) {
            console.error("Menu error:", e);
            // Fallback plain text menu if interactive fails
            let text = `╭─── • 🥀 • ───╮\n`;
            text += `   *INSIDIOUS MENU*  \n`;
            text += `╰─── • 🥀 • ───╯\n\n`;
            text += `Hello ${pushname},\n\n`;
            
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