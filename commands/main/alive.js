const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "status",
    aliases: ["ping", "alive", "runtime"],
    description: "Show bot status with sliding cards",
    
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // Get user's display name
            let userName = pushname;
            if (!userName) {
                const contact = await conn.getContact(sender);
                userName = contact?.name || contact?.pushname || sender.split('@')[0];
            }

            // Prepare image media
            const imageMedia = await prepareWAMessageMedia(
                { image: { url: config.botImage } },
                { upload: conn.waUploadToServer }
            );

            // Calculate ping
            const messageTimestamp = msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now();
            const ping = Date.now() - messageTimestamp;

            // Uptime
            const uptime = runtime(process.uptime());

            // Create cards
            const cards = [];

            // Card 1: Ping
            cards.push({
                body: { text: fancy(
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `   🏓 *PING*\n` +
                    `━━━━━━━━━━━━━━━━━━\n\n` +
                    `📶 Response Time: *${ping}ms*\n\n` +
                    `🤖 Bot is responsive.`
                ) },
                footer: { text: fancy(config.footer) },
                header: {
                    hasMediaAttachment: true,
                    imageMessage: imageMedia.imageMessage
                },
                nativeFlowMessage: {
                    buttons: [{
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🔄 Refresh",
                            id: `${config.prefix}status`
                        })
                    }]
                }
            });

            // Card 2: Alive
            cards.push({
                body: { text: fancy(
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `   🤖 *ALIVE*\n` +
                    `━━━━━━━━━━━━━━━━━━\n\n` +
                    `✨ Bot Name: ${config.botName}\n` +
                    `👑 Developer: ${config.developerName}\n` +
                    `📦 Version: ${config.version}\n\n` +
                    `✅ I'm alive and ready!`
                ) },
                footer: { text: fancy(config.footer) },
                header: {
                    hasMediaAttachment: true,
                    imageMessage: imageMedia.imageMessage
                },
                nativeFlowMessage: {
                    buttons: [{
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🔄 Refresh",
                            id: `${config.prefix}status`
                        })
                    }]
                }
            });

            // Card 3: Runtime
            cards.push({
                body: { text: fancy(
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `   ⏱️ *RUNTIME*\n` +
                    `━━━━━━━━━━━━━━━━━━\n\n` +
                    `🕐 Uptime: *${uptime}*\n\n` +
                    `Bot has been running for ${uptime}.`
                ) },
                footer: { text: fancy(config.footer) },
                header: {
                    hasMediaAttachment: true,
                    imageMessage: imageMedia.imageMessage
                },
                nativeFlowMessage: {
                    buttons: [{
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🔄 Refresh",
                            id: `${config.prefix}status`
                        })
                    }]
                }
            });

            // Build interactive message
            const interactiveMessage = {
                body: { text: fancy(
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `   📊 *BOT STATUS DASHBOARD*\n` +
                    `━━━━━━━━━━━━━━━━━━\n\n` +
                    `👋 Hello, *${userName}*!\n` +
                    `Swipe to view details.`
                ) },
                footer: { text: fancy("◀️ Slide left/right for more info ▶️") },
                header: {
                    title: fancy(config.botName),
                    hasMediaAttachment: false
                },
                carouselMessage: {
                    cards: cards
                }
            };

            // Send as regular interactive message (not view once)
            const waMessage = generateWAMessageFromContent(from, { interactiveMessage }, {
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