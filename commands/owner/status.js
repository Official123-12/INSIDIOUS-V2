const handler = require('../../handler');

module.exports = {
    name: "status",
    aliases: ["poststatus", "mystatus"],
    ownerOnly: true,
    description: "Post a text or image status to your own account",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        // Check if replying to an image/video
        let mediaMessage = null;
        let caption = args.join(' ');

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.imageMessage) {
                mediaMessage = quoted.imageMessage;
            } else if (quoted.videoMessage) {
                mediaMessage = quoted.videoMessage;
            }
        }

        try {
            if (mediaMessage) {
                // Post image/video as status
                await conn.sendMessage('status@broadcast', {
                    image: mediaMessage,
                    caption: caption
                });
                reply("✅ Image status posted!");
            } else if (caption) {
                // Post text status
                await conn.sendMessage('status@broadcast', {
                    text: caption
                });
                reply("✅ Text status posted!");
            } else {
                reply("❌ Please provide text or reply to an image/video.");
            }
        } catch (e) {
            console.error("Status error:", e);
            reply("❌ Failed to post status.");
        }
    }
};