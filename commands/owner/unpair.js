const config = require('../../config');

module.exports = {
    name: "unpair",
    execute: async (conn, msg, args, { from, fancy, config, isOwner, reply }) => {
        if (!isOwner) {
            return await msg.reply("❌ This command is for owner only!");
        }
        
        if (args.length < 2) {
            return await msg.reply(`🗑️ Usage: ${config.prefix}unpair <BOT_ID> <number>\nExample: ${config.prefix}unpair INSABCD12 255712345678`);
        }
        
        const botId = args[0];
        const number = args[1].replace(/[^0-9]/g, '');
        
        await msg.reply(`🗑️ Unpairing Info:
        
🔐 BOT ID: ${botId}
📞 Number: ${number}

🌐 Web Unpairing:
https://stany-min-bot.onrender.com/unpair?num=${number}&bot_id=${botId}

✅ Number will be removed from paired list`);
    }
};
