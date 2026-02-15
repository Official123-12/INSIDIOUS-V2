const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "status",
    aliases: ["ping", "alive", "runtime"],
    description: "Show bot status with sliding cards",
    
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            let userName = pushname;
            if (!userName) {
                try {
                    const contact = await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || sender.split('@')[0];
                } catch {
                    userName = sender.split('@')[0];
                }
            }

            const imageMedia = await prepareWAMessageMedia(
                { image: { url: config.botImage } },
                { upload: conn.waUploadToServer }
            );

            const messageTimestamp = msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now();
            const ping = Date.now() - messageTimestamp;
            const uptime = runtime(process.uptime());

            const cards = [];

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

            const messageContent = { interactiveMessage };
            const waMessage = generateWAMessageFromContent(from, messageContent, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer
            });
            await conn.relayMessage(from, waMessage.message, { messageId: waMessage.key.id });

        } catch (e) {
            console.error("Status error:", e);
            const uptime = runtime(process.uptime());
            const text = `🏓 *PING:* Response time ...\n🤖 *ALIVE:* Bot is online\n⏱️ *RUNTIME:* ${uptime}`;
            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
        }
    }
};