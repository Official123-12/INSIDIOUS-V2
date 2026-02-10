const config = require('../../config');

module.exports = {
    name: "botinfo",
    execute: async (conn, msg, args, { from, fancy, config, isOwner, reply }) => {
        const botId = process.env.BOT_ID || "INSABCD12"; // Will be set from index.js
        
        await msg.reply(`🤖 BOT INFORMATION:
        
🔐 BOT ID: ${botId}
🤖 Name: ${config.botName}
👑 Owner: ${config.ownerName}
⚡ Mode: ${config.workMode}

📊 Limits:
• Max paired numbers: 2
• Only deployer can manage
• Each BOT ID is unique

🔗 Endpoints:
• /pair?num=XXX&bot_id=${botId}
• /unpair?num=XXX&bot_id=${botId}
• /paired

💡 Share BOT ID with trusted users`);
    }
};
