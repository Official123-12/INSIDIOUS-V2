const handler = require('../../handler');

module.exports = {
    name: "listblockmedia",
    aliases: ["listblockedmedia", "blockedmedia"],
    ownerOnly: true,
    description: "List all blocked media types",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        const settings = await handler.loadGlobalSettings();
        let blockedList = settings.blockedMediaTypes || [];

        if (blockedList.length === 0) {
            return reply("📭 No media types are blocked.");
        }

        let text = `╔════════════════════╗\n`;
        text += `║   *BLOCKED MEDIA*   ║\n`;
        text += `╚════════════════════╝\n\n`;
        text += `Total: ${blockedList.length}\n\n`;
        
        blockedList.forEach((type, i) => {
            text += `${i + 1}. ${type}\n`;
        });

        reply(fancy(text));
    }
};