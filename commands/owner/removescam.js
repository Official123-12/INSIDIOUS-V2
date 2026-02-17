const handler = require('../../handler');

module.exports = {
    name: "removescam",
    aliases: ["removescamkeyword", "delscam"],
    ownerOnly: true,
    description: "Remove a scam keyword",
    usage: "<keyword>",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        if (args.length === 0) return reply("❌ Please provide a keyword.");

        const keyword = args.join(' ').toLowerCase().trim();
        if (!keyword) return reply("❌ Invalid keyword.");

        const settings = await handler.loadGlobalSettings();
        let scamList = settings.scamKeywords || [];

        const index = scamList.indexOf(keyword);
        if (index === -1) {
            return reply(`❌ "${keyword}" not found.`);
        }

        scamList.splice(index, 1);
        settings.scamKeywords = scamList;

        await handler.saveGlobalSettings(settings);
        await handler.refreshConfig();

        reply(fancy(`✅ *Scam keyword removed!*\n\n📌 Keyword: ${keyword}\n📊 Total: ${scamList.length}`));
    }
};