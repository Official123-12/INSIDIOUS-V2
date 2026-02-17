const handler = require('../../handler');

module.exports = {
    name: "listscam",
    aliases: ["scamlist", "listscamkeywords"],
    ownerOnly: true,
    description: "List all scam keywords",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        const settings = await handler.loadGlobalSettings();
        let scamList = settings.scamKeywords || [];

        if (scamList.length === 0) {
            return reply("📭 No scam keywords found.");
        }

        let text = `╔════════════════════╗\n`;
        text += `║   *SCAM KEYWORDS*   ║\n`;
        text += `╚════════════════════╝\n\n`;
        text += `Total: ${scamList.length}\n\n`;
        
        scamList.forEach((kw, i) => {
            text += `${i + 1}. ${kw}\n`;
        });

        reply(fancy(text));
    }
};