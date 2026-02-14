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

                // Create buttons for each command in this category
                const buttons = files.map(cmd => ({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `${config.prefix}${cmd}`,
                        id: `${config.prefix}${cmd}`
                    })
                }));

                // Prepare the image for the card header
                const imageMedia = await prepareWAMessageMedia(
                    { image: { url: config.menuImage } },
                    { upload: conn.waUploadToServer }
                );

                // Create a card for this category
                const card = {
                    body: proto.Message.InteractiveMessage.Body.create({
                        text: fancy(`🥀 *${cat.toUpperCase()} CATEGORY*\n\nHello ${pushname},\nSelect a command below.\n\nDev: ${config.developerName}`)
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: fancy(config.footer)
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        hasMediaAttachment: true,
                        ...imageMedia
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: buttons
                    })
                };
                cards.push(card);
            }

            // Build the main interactive message with carousel
            const interactiveMsg = proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({
                    text: fancy(`👹 INSIDIOUS V2.1.1 DASHBOARD\nUptime: ${runtime(process.uptime())}`)
                }),
                footer: proto.Message.InteractiveMessage.Footer.create({
                    text: fancy("Slide left/right for more categories")
                }),
                header: proto.Message.InteractiveMessage.Header.create({
                    title: fancy(config.botName),
                    hasMediaAttachment: false
                }),
                carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
                    cards: cards
                })
            });

            // Wrap in viewOnceMessage (optional, message disappears after viewing once)
            const viewOnceMsg = {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: interactiveMsg
                    }
                }
            };

            // Generate the full message and relay it
            const waMessage = generateWAMessageFromContent(from, viewOnceMsg, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer
            });
            await conn.relayMessage(from, waMessage.message, { messageId: waMessage.key.id });

        } catch (e) {
            console.error("Menu error:", e);
            // Fallback to simple text menu if interactive fails
            let helpText = `╭─── • 🥀 • ───╮\n`;
            helpText += `   *INSIDIOUS MENU*  \n`;
            helpText += `╰─── • 🥀 • ───╯\n\n`;
            helpText += `Hello ${pushname},\n\n`;
            
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath);
            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                if (!fs.statSync(catPath).isDirectory()) continue;
                const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
                if (files.length) {
                    helpText += `*${cat.toUpperCase()}*\n`;
                    helpText += files.map(cmd => `${config.prefix}${cmd}`).join(', ') + '\n\n';
                }
            }
            helpText += `\n_Uptime: ${runtime(process.uptime())}_`;
            await conn.sendMessage(from, { text: fancy(helpText) }, { quoted: msg });
        }
    }
};