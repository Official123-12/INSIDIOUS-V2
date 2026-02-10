const { Settings } = require('../database/models');

module.exports = {
    name: "settings",
    desc: "Manage bot settings",
    category: "owner",
    ownerOnly: true,

    execute: async (context) => {
        const { conn, from, args, reply, config, settings: currentSettings } = context;
        
        const subcommand = args[0]?.toLowerCase();
        
        if (!subcommand) {
            // Show settings menu
            let menu = `╭─── • 🥀 • ───╮\n   SETTINGS MENU\n╰─── • 🥀 • ───╯\n\n`;
            
            menu += `📊 Current Settings:\n`;
            menu += `├ 🔗 Antilink: ${currentSettings.antilink ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 🚫 Antiporn: ${currentSettings.antiporn ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ ⚠️ Antiscam: ${currentSettings.antiscam ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 📷 Antimedia: ${currentSettings.antimedia ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ #️⃣ Antitag: ${currentSettings.antitag ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 👁️ Antiviewonce: ${currentSettings.antiviewonce ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 🗑️ Antidelete: ${currentSettings.antidelete ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 💤 Sleeping Mode: ${currentSettings.sleepingMode ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 🤖 Chatbot: ${currentSettings.chatbot ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 📞 Anticall: ${currentSettings.anticall ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 👀 Auto Read: ${currentSettings.autoRead ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ ❤️ Auto React: ${currentSettings.autoReact ? '✅ ON' : '❌ OFF'}\n`;
            menu += `├ 👋 Welcome/Goodbye: ${currentSettings.welcomeGoodbye ? '✅ ON' : '❌ OFF'}\n`;
            menu += `└ 🔒 Work Mode: ${currentSettings.workMode || 'public'}\n\n`;
            
            menu += `⚙️ Usage:\n`;
            menu += `• ${config.prefix}settings on/off [feature]\n`;
            menu += `• ${config.prefix}settings list\n`;
            menu += `• ${config.prefix}settings set [feature] [value]\n`;
            menu += `• ${config.prefix}settings reset\n\n`;
            
            menu += `📋 Features: antilink, antiporn, antiscam, antimedia, antitag, antiviewonce, antidelete, sleepingmode, chatbot, anticall, autoread, autoreact, welcome, autobio, autosave, autostatus, antibug, antispam\n`;
            
            return await reply(menu);
        }
        
        if (subcommand === 'on' || subcommand === 'off') {
            const feature = args[1]?.toLowerCase();
            const value = subcommand === 'on';
            
            if (!feature) {
                return await reply(`Specify feature! Example: ${config.prefix}settings on antilink`);
            }
            
            const validFeatures = [
                'antilink', 'antiporn', 'antiscam', 'antitag', 'antiviewonce', 
                'antidelete', 'sleepingmode', 'welcome', 'chatbot', 'anticall',
                'autobio', 'autoreact', 'autosave', 'autostatus', 'autoread',
                'antibug', 'antispam', 'activeMembers', 'autoblockCountry',
                'antimedia', 'downloadstatus'
            ];
            
            if (!validFeatures.includes(feature)) {
                return await reply(`Invalid feature! Valid: ${validFeatures.join(', ')}`);
            }
            
            // Update setting
            try {
                let dbSettings = await Settings.findOne();
                if (!dbSettings) {
                    dbSettings = new Settings();
                }
                
                dbSettings[feature] = value;
                await dbSettings.save();
                
                return await reply(`✅ ${feature} turned ${subcommand.toUpperCase()}`);
            } catch (error) {
                return await reply(`❌ Error: ${error.message}`);
            }
        }
        
        if (subcommand === 'list') {
            let list = `╭─── • 🥀 • ───╮\n   ALL FEATURES\n╰─── • 🥀 • ───╯\n\n`;
            
            const features = [
                { name: '🔗 Antilink', value: currentSettings.antilink },
                { name: '🚫 Antiporn', value: currentSettings.antiporn },
                { name: '⚠️ Antiscam', value: currentSettings.antiscam },
                { name: '📷 Antimedia', value: currentSettings.antimedia },
                { name: '#️⃣ Antitag', value: currentSettings.antitag },
                { name: '👁️ Antiviewonce', value: currentSettings.antiviewonce },
                { name: '🗑️ Antidelete', value: currentSettings.antidelete },
                { name: '💤 Sleeping Mode', value: currentSettings.sleepingMode },
                { name: '👋 Welcome/Goodbye', value: currentSettings.welcomeGoodbye },
                { name: '🤖 Chatbot', value: currentSettings.chatbot },
                { name: '📞 Anticall', value: currentSettings.anticall },
                { name: '👀 Auto Read', value: currentSettings.autoRead },
                { name: '❤️ Auto React', value: currentSettings.autoReact },
                { name: '💾 Auto Save', value: currentSettings.autoSave },
                { name: '📝 Auto Bio', value: currentSettings.autoBio },
                { name: '📱 Auto Status', value: currentSettings.autoStatus },
                { name: '📥 Download Status', value: currentSettings.downloadStatus },
                { name: '🐛 Antibug', value: currentSettings.antibug },
                { name: '📢 Antispam', value: currentSettings.antispam },
                { name: '👥 Active Members', value: currentSettings.activeMembers },
                { name: '🌍 Autoblock Country', value: currentSettings.autoblockCountry }
            ];
            
            features.forEach(feat => {
                list += `${feat.name}: ${feat.value ? '🟢 ON' : '🔴 OFF'}\n`;
            });
            
            return await reply(list);
        }
        
        if (subcommand === 'set') {
            const feature = args[1];
            const value = args[2];
            
            if (!feature || !value) {
                return await reply(`Usage: ${config.prefix}settings set [feature] [value]\nExample: ${config.prefix}settings set workmode public`);
            }
            
            try {
                let dbSettings = await Settings.findOne();
                if (!dbSettings) {
                    dbSettings = new Settings();
                }
                
                switch(feature.toLowerCase()) {
                    case 'workmode':
                        if (['public', 'private'].includes(value.toLowerCase())) {
                            dbSettings.workMode = value.toLowerCase();
                            await dbSettings.save();
                            return await reply(`✅ Work Mode set to: ${value}`);
                        }
                        break;
                        
                    case 'prefix':
                        if (value.length === 1) {
                            dbSettings.commandPrefix = value;
                            await dbSettings.save();
                            return await reply(`✅ Command prefix set to: ${value}`);
                        }
                        break;
                        
                    default:
                        return await reply(`Feature "${feature}" cannot be set with value. Use on/off.`);
                }
            } catch (error) {
                return await reply(`❌ Error: ${error.message}`);
            }
        }
        
        if (subcommand === 'reset') {
            try {
                await Settings.deleteMany({});
                const newSettings = new Settings();
                await newSettings.save();
                
                return await reply('✅ All settings reset to defaults!');
            } catch (error) {
                return await reply(`❌ Error: ${error.message}`);
            }
        }
        
        // Show help
        await reply(`Invalid subcommand. Use:\n${config.prefix}settings on/off [feature]\n${config.prefix}settings list\n${config.prefix}settings set [feature] [value]\n${config.prefix}settings reset`);
    }
};
