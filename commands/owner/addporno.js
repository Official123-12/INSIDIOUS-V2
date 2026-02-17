const handler = require('../../handler');

module.exports = {
    name: "addporn",
    aliases: ["addpornkeyword", "newporn"],
    ownerOnly: true,
    description: "Add a new porn keyword",
    usage: "<keyword>",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        if (args.length === 0) return reply("❌ Please provide a keyword.");

        const keyword = args.join(' ').toLowerCase().trim();
        if (!keyword) return reply("❌ Invalid keyword.");

        const settings = await handler.loadGlobalSettings();
        let pornList = settings.pornKeywords || [];

        if (pornList.includes(keyword)) {
            return reply(`❌ "${keyword}" already exists.`);
        }

        pornList.push(keyword);
        settings.pornKeywords = pornList;

        await handler.saveGlobalSettings(settings);
        await handler.refreshConfig();

        reply(fancy(`✅ *Porn keyword added!*\n\n📌 Keyword: ${keyword}\n📊 Total: ${pornList.length}`));
    }
};