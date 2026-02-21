const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: "woww",
    aliases: ["vv", "openvo"],
    description: "Open a view-once message (reply to it) and notify the bot owner",
    usage: ".woww (reply to view-once media)",
    
    execute: async (conn, msg, args, { from, sender, fancy, config, reply }) => {
        try {
            // Check if replying to a message
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                return reply("❌ Please reply to a view-once image or video.");
            }

            // Check if it's a view-once message
            const viewOnce = quotedMsg.viewOnceMessageV2?.message;
            if (!viewOnce) {
                return reply("❌ The replied message is not a view-once media.");
            }

            let mediaType = null;
            let mediaMessage = null;
            let caption = '';

            if (viewOnce.imageMessage) {
                mediaType = 'image';
                mediaMessage = viewOnce.imageMessage;
                caption = mediaMessage.caption || '';
            } else if (viewOnce.videoMessage) {
                mediaType = 'video';
                mediaMessage = viewOnce.videoMessage;
                caption = mediaMessage.caption || '';
            } else {
                return reply("❌ Unsupported view-once media type (only image/video).");
            }

            // Download the media
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            const buffer = [];
            for await (const chunk of stream) {
                buffer.push(chunk);
            }
            const mediaBuffer = Buffer.concat(buffer);

            // Send the media to the user in the same chat
            const mediaToSend = mediaType === 'image' 
                ? { image: mediaBuffer, caption } 
                : { video: mediaBuffer, caption };
            
            await conn.sendMessage(from, mediaToSend, { quoted: msg });

            // Get sender's name
            const senderName = msg.pushName || sender.split('@')[0];

            // Get bot's own number (the owner of this bot)
            const botNumber = conn.user.id.split(':')[0];
            const ownerJid = botNumber + '@s.whatsapp.net';

            const notification = `🔐 *VIEW-ONCE OPENED*\n\nOpened by: @${sender.split('@')[0]} (${senderName})\nType: ${mediaType}\nCaption: ${caption || 'None'}\nTime: ${new Date().toLocaleString()}`;
            
            // Send notification to the bot's own number only
            await conn.sendMessage(ownerJid, {
                text: notification,
                mentions: [sender],
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                        newsletterName: config.botName || 'INSIDIOUS BOT',
                    }
                }
            }).catch(() => {});

        } catch (error) {
            console.error('[WOWW] Error:', error);
            reply("❌ Failed to open view-once message. Make sure it's a valid view-once media.");
        }
    }
};