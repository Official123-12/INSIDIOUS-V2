const handler = require('../../handler');

module.exports = {
    name: "listblockedcountries",
    aliases: ["blockedcountries", "countrylist"],
    ownerOnly: true,
    description: "List all blocked country codes",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        const settings = await handler.loadGlobalSettings();
        let blockedList = settings.blockedCountries || [];

        if (blockedList.length === 0) {
            return reply("📭 No countries are blocked.");
        }

        let text = `╔════════════════════╗\n`;
        text += `║   *BLOCKED COUNTRIES*   ║\n`;
        text += `╚════════════════════╝\n\n`;
        text += `Total: ${blockedList.length}\n\n`;
        
        blockedList.forEach((code, i) => {
            text += `${i + 1}. +${code}\n`;
        });

        reply(fancy(text));
    }
};