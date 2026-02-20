const axios = require('axios');

module.exports = {
    name: "spotify",
    aliases: ["sp", "spdl"],
    description: "Download Spotify track",
    usage: ".sp <track_url>",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) return reply("❌ Please provide a Spotify track URL.\nExample: .sp https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl");
            
            const url = encodeURIComponent(args[0]);
            await reply("⏳ Downloading from Spotify...");
            
            const apiUrl = `https://ef-prime-md-ultra-apis.vercel.app/downloader/sp-dl?url=${url}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            
            if (response.status !== 200 || !response.data) {
                return reply("❌ Failed to download. API returned error.");
            }
            
            const data = response.data;
            const audioUrl = data.audioUrl || data.downloadUrl || data.url;
            
            if (!audioUrl) {
                return reply("❌ No audio URL found in response.");
            }
            
            await conn.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: 'spotify_track.mp3',
                caption: "✅ Spotify track downloaded",
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
            console.error('[SPOTIFY] Error:', error);
            reply("❌ Spotify download failed.");
        }
    }
};