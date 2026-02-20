const axios = require('axios');

module.exports = {
    name: "fb",
    aliases: ["fab", "fbdl"],
    description: "Download Facebook video (v1)",
    usage: ".fb <video_url>",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) return reply("❌ Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/watch?v=123456789");
            
            const url = encodeURIComponent(args[0]);
            await reply("⏳ Downloading Facebook video...");
            
            const apiUrl = `https://ef-prime-md-ultra-apis.vercel.app/downloader/fbdl?url=${url}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            
            if (response.status !== 200 || !response.data) {
                return reply("❌ Failed to download. API returned error.");
            }
            
            const data = response.data;
            const videoUrl = data.videoUrl || data.downloadUrl || (data.medias && data.medias[0]?.url);
            
            if (!videoUrl) {
                return reply("❌ No video URL found in response.");
            }
            
            await conn.sendMessage(from, {
                video: { url: videoUrl },
                caption: "✅ Facebook video downloaded",
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
            
        } catch (error) {
            console.error('[FACEBOOK] Error:', error);
            reply("❌ Facebook download failed. Try the v2 command: .fb2 <url>");
        }
    }
};