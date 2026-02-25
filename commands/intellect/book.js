const axios = require('axios');
const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "books",
    description: "List books by category",
    usage: "[category]",
    execute: async (conn, msg, args, { from, reply, fancy }) => {
        try {
            if (!args[0]) return reply("❌ Provide a category, e.g., `.books Aqeedah`");
            const category = encodeURIComponent(args.join(' '));
            const apiUrl = `https://discardapi.dpdns.org/api/get/books?category=${category}`;
            const response = await axios.get(apiUrl);
            const data = response.data;

            if (!data.status) return reply("❌ No books found for that category.");

            let text = `╭━━━━━━━━━━━━━━╮\n   📚 *BOOKS*  \n╰━━━━━━━━━━━━━━╯\n\n`;
            text += `Category: *${args.join(' ')}*\n\n`;
            const books = data.result || data.books || [];
            books.forEach((book, i) => {
                text += `${i+1}. ${book.title}\n   ↳ ${book.link || 'No link'}\n`;
            });
            text += `\n━━━━━━━━━━━━━━\n👑 Developer: ${config.developerName}`;

            await conn.sendMessage(from, {
                text: fancy(text),
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