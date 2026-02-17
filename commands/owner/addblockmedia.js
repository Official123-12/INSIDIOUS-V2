const handler = require('../../handler');

module.exports = {
    name: "addblockmedia",
    aliases: ["addblockedmedia", "blockmedia"],
    ownerOnly: true,
    description: "Add a media type to block (photo, video, sticker, audio, document, all)",
    usage: "<type>",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        if (args.length === 0) return reply("❌ Please provide a media type.");

        const type = args[0].toLowerCase().trim();
        const validTypes = ['photo', 'video', 'sticker', 'audio', 'document', 'all'];
        
        if (!validTypes.includes(type)) {
            return reply(`❌ Invalid type. Valid: ${validTypes.join(', ')}`);
        }

        const settings = await handler.loadGlobalSettings();
        let blockedList = settings.blockedMediaTypes || [];

        if (blockedList.includes(type)) {
            return reply(`❌ "${type}" is already blocked.`);
        }

        blockedList.push(type);
        settings.blockedMediaTypes = blockedList;

        await handler.saveGlobalSettings(settings);
        await handler.refreshConfig();

        reply(fancy(`✅ *Media type blocked!*\n\n📌 Type: ${type}\n📊 Total blocked: ${blockedList.length}`));
    }
};