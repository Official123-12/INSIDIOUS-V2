const config = require('../../config');

module.exports = {
    name: "restart",
    description: "Restart the bot",
    execute: async (conn, msg, args, { from, fancy, config, isOwner, reply }) => {
        if (!isOwner) {
            return await reply("❌ This command is for owner only!");
        }
        
        await reply(`🔄 *RESTARTING BOT...*\n\nPlease wait 10-20 seconds for bot to reconnect.\n\n⚡ Bot will be back online shortly!`);
        
        // Close connection and let process manager restart
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    }
};
