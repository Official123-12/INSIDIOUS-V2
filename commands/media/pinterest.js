const axios = require('axios');

module.exports = {
    name: "pinterest",
    aliases: ["pin", "pindl"],
    description: "Download Pinterest image/video",
    usage: ".pin <pin_url>",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) return reply("❌ Please provide a Pinterest URL.\nExample: .pin https://www.pinterest.com/pin/123456789/");
            
            const url = encodeURIComponent(args[0]);
            await reply("⏳ Downloading from Pinterest...");
            
            const apiUrl = `https://ef-prime-md-ultra-apis.vercel.app/downloader/pindl?url=${url}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            
            if (response.status !== 200 || !response.data) {
                return reply("❌ Failed to download. API returned error.");
            }
            
            const data = response.data;
            const mediaUrl = data.imageUrl || data.videoUrl || data.downloadUrl;
            
            if (!mediaUrl) {
                return reply("❌ No media URL found in response.");
            }
            
            // Determine if it's video or image
            const isVideo = mediaUrl.includes('.mp4') || data.type === 'video';
            
            if (isVideo) {
                await conn.sendMessage(from, {
                    video: { url: mediaUrl },
                    caption: "✅ Pinterest video downloaded",
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: "120363404317544295@newsletter",
                            newsletterName: "INSIDIOUS BOT",
                            serverMessageId: 100
                        }
                    }
                }, { quoted: msg });
            } else {
                await conn.sendMessage(from, {
                    image: { url: mediaUrl },
                    caption: "✅ Pinterest image downloaded",
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: "120363404317544295@newsletter",
                            newsletterName: "INSIDIOUS BOT",
                            serverMessageId: 100
                        }
                    }
                }, { quoted: msg });
            }
            
        } catch (error) {
            console.error('[PINTEREST] Error:', error);
            reply("❌ Pinterest download failed.");
        }
    }
};