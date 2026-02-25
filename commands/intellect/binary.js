const axios = require('axios');
const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "binary",
    description: "Encode or decode binary",
    usage: "[encode/decode] [text]",
    execute: async (conn, msg, args, { from, reply, fancy }) => {
        try {
            if (args.length < 2) return reply("❌ Usage: `.binary encode Hello` or `.binary decode 01001000`");
            const mode = args[0].toLowerCase();
            if (!['encode', 'decode'].includes(mode)) return reply("❌ Mode must be 'encode' or 'decode'.");
            const data = encodeURIComponent(args.slice(1).join(' '));
            const apiUrl = `https://discardapi.dpdns.org/api/tools/binary?mode=${mode}&data=${data}`;
            const response = await axios.get(apiUrl);
            const result = response.data.result || response.data.output || response.data;

            await conn.sendMessage(from, {
                text: fancy(`🔢 *Binary ${mode}*\n\n${result}`),
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