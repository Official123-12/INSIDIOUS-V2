const handler = require('../../handler');

module.exports = {
    name: "addemoji",
    aliases: ["addreactemoji", "newreactemoji"],
    ownerOnly: true,
    description: "Add an emoji to auto-react list",
    usage: "<emoji>",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        if (args.length === 0) return reply("❌ Please provide an emoji.");

        const emoji = args.join(' ').trim();
        if (!emoji) return reply("❌ Invalid emoji.");

        const settings = await handler.loadGlobalSettings();
        let emojiList = settings.autoReactEmojis || [];

        if (emojiList.includes(emoji)) {
            return reply(`❌ "${emoji}" already exists.`);
        }

        emojiList.push(emoji);
        settings.autoReactEmojis = emojiList;

        await handler.saveGlobalSettings(settings);
        await handler.refreshConfig();

        reply(fancy(`✅ *Auto-react emoji added!*\n\n📌 Emoji: ${emoji}\n📊 Total: ${emojiList.length}`));
    }
};