const config = require('../../config');

module.exports = {
    name: "kill",
    description: "Stop the bot",
    execute: async (conn, msg, args, { from, fancy, config, isOwner, reply }) => {
        if (!isOwner) {
            return await reply("❌ This command is for owner only!");
        }
        
        await reply(`🛑 *STOPPING BOT...*\n\nBot will be shut down.\n\nTo restart, you need to manually start the bot again.\n\n👑 Owner action confirmed.`);
        
        // Close connection and exit
        setTimeout(() => {
            process.exit(1);
        }, 2000);
    }
};
