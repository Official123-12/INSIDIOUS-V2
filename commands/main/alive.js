const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "status",
    aliases: ["ping", "alive", "runtime"],
    description: "Show bot status with sliding cards",
    
    execute: async (conn, msg, args, { from, pushname }) => {
        try {
            // Prepare image media (use bot image from config)
            const imageMedia = await prepareWAMessageMedia(
                { image: { url: config.botImage } },
                { upload: conn.waUploadToServer }
            );

            // Calculate ping: time between message receipt and now
            const messageTimestamp = msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now();
            const ping = Date.now() - messageTimestamp;

            // Uptime
            const uptime = runtime(process.uptime());

            // Create cards
            const cards = [];

            // Card 1: Ping
            cards.push({
                body: { text: fancy(`🏓 *PING*\n\nResponse Time: ${ping}ms\n\nBot is responsive.`) },
                footer: { text: fancy(config.footer) },
                header: {
                    hasMediaAttachment: true,
                    imageMessage: imageMedia.imageMessage
                },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "🔄 Refresh",
                                id: `${config.prefix}status`
                            })
                        }
                    ]
                }
            });

            // Card 2: Alive
            cards.push({
                body: { text: fancy(`🤖 *ALIVE*\n\nBot Name: ${config.botName}\nDeveloper: ${config.developerName}\nVersion: ${config.version}\n\nI'm alive and ready!`) },
                footer: { text: fancy(config.footer) },
                header: {
                    hasMediaAttachment: true,
                    imageMessage: imageMedia.imageMessage
                },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "🔄 Refresh",
                                id: `${config.prefix}status`
                            })
                        }
                    ]
                }
            });

            // Card 3: Runtime
            cards.push({
                body: { text: fancy(`⏱️ *RUNTIME*\n\nUptime: ${uptime}\n\nBot has been running for ${uptime}.`) },
                footer: { text: fancy(config.footer) },
                header: {
                    hasMediaAttachment: true,
                    imageMessage: imageMedia.imageMessage
                },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "🔄 Refresh",
                                id: `${config.prefix}status`
                            })
                        }
                    ]
                }
            });

            // Build interactive message
            const interactiveMessage = {
                body: { text: fancy(`📊 *BOT STATUS DASHBOARD*\n\nHello ${pushname}, swipe to view details.`) },
                footer: { text: fancy("Slide left/right for more info") },
                header: {
                    title: fancy(config.botName),
                    hasMediaAttachment: false
                },
                carouselMessage: {
                    cards: cards
                }
            };

            // Wrap in viewOnceMessage (optional)
            const viewOnceMessage = {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: interactiveMessage
                    }
                }
            };

            // Generate and send
            const waMessage = generateWAMessageFromContent(from, viewOnceMessage, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer
            });
            await conn.relayMessage(from, waMessage.message, { messageId: waMessage.key.id });

        } catch (e) {
            console.error("Status error:", e);
            // Fallback plain text
            const uptime = runtime(process.uptime());
            const text = `🏓 *PING:* Response time ...\n🤖 *ALIVE:* Bot is online\n⏱️ *RUNTIME:* ${uptime}`;
            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
        }
    }
};