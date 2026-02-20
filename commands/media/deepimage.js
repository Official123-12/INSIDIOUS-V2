const axios = require('axios');

module.exports = {
    name: "deepimg",
    aliases: ["imggen", "deepimage"],
    description: "Generate image from text",
    usage: ".deepimg <prompt> [style] [size]",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) return reply("❌ Please provide a prompt.\nExample: .deepimg girl wearing glasses");
            
            const prompt = encodeURIComponent(args.join(' '));
            const style = 'anime'; // default style
            const size = '3:2'; // default size
            
            await reply("⏳ Generating image (may take a moment)...");
            
            const apiUrl = `https://ef-prime-md-ultra-apis.vercel.app/ai/deepimg?prompt=${prompt}&style=${style}&size=${size}`;
            const response = await axios.get(apiUrl, { timeout: 60000, responseType: 'arraybuffer' });
            
            if (response.status !== 200 || !response.data) {
                return reply("❌ Image generation failed.");
            }
            
            await conn.sendMessage(from, {
                image: Buffer.from(response.data),
                caption: "✅ AI generated image",
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
            console.error('[DEEPIMG] Error:', error);
            reply("❌ Image generation failed. Try a different prompt.");
        }
    }
};