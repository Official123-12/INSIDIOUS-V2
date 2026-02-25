const axios = require('axios');
const config = require('../../config');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "prayer",
    aliases: ["jadwal"],
    description: "Get prayer times for a city",
    usage: "[city]",
    execute: async (conn, msg, args, { from, reply, fancy }) => {
        try {
            if (!args[0]) return reply("❌ Please provide a city name, e.g., `.prayer jakarta`");
            const city = encodeURIComponent(args.join(' '));
            const apiUrl = `https://discardapi.dpdns.org/api/prayer/timing?city=${city}`;
            const response = await axios.get(apiUrl);
            const data = response.data;

            if (!data.status) return reply("❌ City not found or API error.");

            // Assume the response contains prayer times (adjust based on actual structure)
            const times = data.result || data.timings || data;
            let text = `╭━━━━━━━━━━━━━━╮\n   🕋 *PRAYER TIMES*  \n╰━━━━━━━━━━━━━━╯\n\n`;
            text += `📍 City: *${args.join(' ')}*\n`;
            for (let [key, value] of Object.entries(times)) {
                text += `│ ${key}: ${value}\n`;
            }
            text += `└────────────────────\n👑 Developer: ${config.developerName}`;

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