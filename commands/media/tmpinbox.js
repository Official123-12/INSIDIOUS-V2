const axios = require('axios');

module.exports = {
    name: "tmpinbox",
    aliases: ["tempmailinbox", "checkmail"],
    description: "Check temporary email inbox",
    usage: ".tmpinbox <token>",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) return reply("❌ Please provide a token.\nExample: .tmpinbox your_token_here");
            
            const token = args[0];
            await reply("⏳ Fetching inbox...");
            
            const apiUrl = `https://ef-prime-md-ultra-apis.vercel.app/tempmail/inbox?token=${token}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            
            if (response.status !== 200 || !response.data) {
                return reply("❌ Failed to fetch inbox. API error.");
            }
            
            const data = response.data;
            const messages = data.messages || data.inbox || [];
            
            if (!messages.length) {
                return reply("📭 No messages found.");
            }
            
            let inboxText = `📬 *Temporary Inbox*\n\n`;
            messages.slice(0, 5).forEach((msg, i) => {
                inboxText += `${i+1}. From: ${msg.from || 'Unknown'}\n`;
                inboxText += `   Subject: ${msg.subject || 'No subject'}\n`;
                inboxText += `   Time: ${msg.date || msg.timestamp || 'Unknown'}\n\n`;
            });
            
            await conn.sendMessage(from, {
                text: fancy(inboxText),
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
            console.error('[TMPINBOX] Error:', error);
            reply("❌ Failed to fetch inbox.");
        }
    }
};