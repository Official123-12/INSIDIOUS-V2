// Load database models
let Settings;
try {
    const models = require('../../database/models');
    Settings = models.Settings;
} catch (error) {
    Settings = { 
        findOne: async () => ({ 
            antilink: true, antiporn: true, antiscam: true, 
            save: async function() { return this; }
        }) 
    };
}

module.exports = {
    name: "settings",
    desc: "Manage bot settings",
    category: "owner",
    ownerOnly: true,

    execute: async ({ conn, msg, args, from, sender, isGroup, isOwner, pushname, reply, config }) => {
        // FIXED: Destructure from params object
        if (!isOwner) {
            return reply("❌ This command is only for bot owner!");
        }
        
        const subcommand = args[0]?.toLowerCase();
        
        if (!subcommand) {
            // Show current settings
            const settings = await Settings.findOne() || {};
            
            let menu = `╭─── • 🥀 • ───╮\n   SETTINGS MENU\n╰─── • 🥀 • ───╯\n\n`;
            menu += `📊 Current Settings:\n`;
            menu += `├ 🔗 Antilink: ${settings.antilink ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 🚫 Antiporn: ${settings.antiporn ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ ⚠️ Antiscam: ${settings.antiscam ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 📷 Antimedia: ${settings.antimedia ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ #️⃣ Antitag: ${settings.antitag ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 👁️ Antiviewonce: ${settings.antiviewonce ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 🗑️ Antidelete: ${settings.antidelete ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 💤 Sleeping Mode: ${settings.sleepingMode ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 🤖 Chatbot: ${settings.chatbot ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 📞 Anticall: ${settings.anticall ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 👀 Auto Read: ${settings.autoRead ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ ❤️ Auto React: ${settings.autoReact ? '✅ ON' : '❌ OFF'}\n`;
            menu += `└ 👋 Welcome/Goodbye: ${settings.welcomeGoodbye ? '✅ ON' : '❌ OFF'}\n\n`;
            
            menu += `⚙️ Usage:\n`;
            menu += `• ${config.prefix}settings on [feature]\n`;
            menu += `• ${config.prefix}settings off [feature]\n`;
            menu += `• ${config.prefix}settings list\n`;
            
            return reply(menu);
        }
        
        if (subcommand === 'on' || subcommand === 'off') {
            const feature = args[1]?.toLowerCase();
            const value = subcommand === 'on';
            
            if (!feature) {
                return reply(`Specify feature! Example: ${config.prefix}settings on antilink`);
            }
            
            const validFeatures = [
                'antilink', 'antiporn', 'antiscam', 'antitag', 'antiviewonce', 
                'antidelete', 'sleepingmode', 'welcome', 'chatbot', 'anticall',
                'autoreact', 'autoread', 'antibug', 'antispam', 'antimedia'
            ];
            
            if (!validFeatures.includes(feature)) {
                return reply(`Invalid feature! Valid: ${validFeatures.join(', ')}`);
            }
            
            // Update setting
            try {
                let dbSettings = await Settings.findOne();
                if (!dbSettings) {
                    dbSettings = new Settings();
                }
                
                dbSettings[feature] = value;
                dbSettings.updatedAt = new Date();
                await dbSettings.save();
                
                return reply(`✅ ${feature} turned ${value ? 'ON' : 'OFF'}`);
            } catch (error) {
                return reply(`❌ Error: ${error.message}`);
            }
        }
        
        if (subcommand === 'list') {
            const settings = await Settings.findOne() || {};
            let list = `╭─── • 🥀 • ───╮\n   ALL FEATURES\n╰─── • 🥀 • ───╯\n\n`;
            
            const features = [
                { name: '🔗 Antilink', key: 'antilink' },
                { name: '🚫 Antiporn', key: 'antiporn' },
                { name: '⚠️ Antiscam', key: 'antiscam' },
                { name: '📷 Antimedia', key: 'antimedia' },
                { name: '#️⃣ Antitag', key: 'antitag' },
                { name: '👁️ Antiviewonce', key: 'antiviewonce' },
                { name: '🗑️ Antidelete', key: 'antidelete' },
                { name: '💤 Sleeping Mode', key: 'sleepingMode' },
                { name: '👋 Welcome/Goodbye', key: 'welcomeGoodbye' },
                { name: '🤖 Chatbot', key: 'chatbot' },
                { name: '📞 Anticall', key: 'anticall' },
                { name: '👀 Auto Read', key: 'autoRead' },
                { name: '❤️ Auto React', key: 'autoReact' },
                { name: '📢 Antispam', key: 'antispam' },
                { name: '🐛 Antibug', key: 'antibug' }
            ];
            
            features.forEach(feat => {
                list += `${feat.name}: ${settings[feat.key] ? '🟢 ON' : '🔴 OFF'}\n`;
            });
            
            return reply(list);
        }
        
        return reply(`Invalid subcommand. Use:\n${config.prefix}settings on/off [feature]\n${config.prefix}settings list`);
    }
};
