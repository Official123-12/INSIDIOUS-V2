const axios = require('axios');

module.exports = {
    name: "copilot",
    aliases: ["co", "copilotai"],
    description: "Chat with Microsoft Copilot",
    usage: ".co <your message>",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) return reply("❌ Please provide a message.\nExample: .co Hello, how are you?");
            
            const message = encodeURIComponent(args.join(' '));
            await reply("⏳ Asking Copilot...");
            
            const apiUrl = `https://ef-prime-md-ultra-apis.vercel.app/ai/copilot?message=${message}&model=default`;
            const response = await axios.get(apiUrl, { timeout: 30000 });
            
            if (response.status !== 200 || !response.data) {
                return reply("❌ Copilot service error.");
            }
            
            const answer = response.data.reply || response.data.answer || response.data.response || JSON.stringify(response.data);
            
            await conn.sendMessage(from, {
                text: fancy(`🤖 *Copilot Reply*\n\n${answer}`),
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
            console.error('[COPILOT] Error:', error);
            reply("❌ Copilot failed.");
        }
    }
};