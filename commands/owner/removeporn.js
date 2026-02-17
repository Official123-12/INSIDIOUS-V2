const handler = require('../../handler');

module.exports = {
    name: "removeporn",
    aliases: ["removepornkeyword", "delporn"],
    ownerOnly: true,
    description: "Remove a porn keyword",
    usage: "<keyword>",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        if (args.length === 0) return reply("❌ Please provide a keyword.");

        const keyword = args.join(' ').toLowerCase().trim();
        if (!keyword) return reply("❌ Invalid keyword.");

        const settings = await handler.loadGlobalSettings();
        let pornList = settings.pornKeywords || [];

        const index = pornList.indexOf(keyword);
        if (index === -1) {
            return reply(`❌ "${keyword}" not found.`);
        }

        pornList.splice(index, 1);
        settings.pornKeywords = pornList;

        await handler.saveGlobalSettings(settings);
        await handler.refreshConfig();

        reply(fancy(`✅ *Porn keyword removed!*\n\n📌 Keyword: ${keyword}\n📊 Total: ${pornList.length}`));
    }
};