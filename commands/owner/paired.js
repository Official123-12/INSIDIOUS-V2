const config = require('../../config');

module.exports = {
    name: "paired",
    description: "Show all paired numbers",
    execute: async (conn, msg, args, { from, fancy, config, isOwner, reply }) => {
        if (!isOwner) {
            return await reply("❌ This command is for owner only!");
        }
        
        try {
            // This would come from database in real implementation
            // For now, we'll show a mock list
            const pairedList = [
                { number: config.ownerNumber[0], status: "Active", since: "2025-01-01" }
            ];
            
            let message = `📋 *PAIRED NUMBERS LIST*\n\n`;
            
            pairedList.forEach((pair, index) => {
                message += `${index + 1}. 📱 *${pair.number}*\n   🔹 Status: ${pair.status}\n   🔹 Since: ${pair.since}\n\n`;
            });
            
            message += `📊 *Total:* ${pairedList.length} number(s)\n`;
            message += `🔐 *Limit:* Max 2 numbers\n\n`;
            message += `💡 *Commands:*\n${config.prefix}pair <number> - Add number\n${config.prefix}unpair <number> - Remove number`;
            
            await reply(message);
            
        } catch (error) {
            console.error("Paired list error:", error);
            await reply(`❌ Failed to get paired list: ${error.message}`);
        }
    }
};
