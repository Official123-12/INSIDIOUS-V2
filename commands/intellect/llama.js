const axios = require('axios');
const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "llama",
    description: "Chat with Llama AI",
    usage: "[question]",
    execute: async (conn, msg, args, { from, reply, fancy }) => {
        try {
            if (!args.length) return reply("❌ Please ask something, e.g., `.llama What is AI?`");
            const question = encodeURIComponent(args.join(' '));
            const apiUrl = `https://discardapi.dpdns.org/api/bot/llama?text=${question}`;
            const response = await axios.get(apiUrl);
            const data = response.data;

            const answer = data.result || data.response || data.message || "No answer received.";
            await conn.sendMessage(from, {
                text: fancy(`🦙 *Llama AI*\n\n${answer}`),
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.newsletterJid,
                        newsletterName: config.botName
                    }
                }
            }, { quoted: msg });
        } catch (e) {
            reply(`❌ Error: ${e.message}`);
        }
    }
};