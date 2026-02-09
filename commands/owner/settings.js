const { fancy } = require('../lib/font');
const { Settings } = require('../database/models');

module.exports.execute = async (conn, msg, args, { from, sender, isOwner, pushname, config, settings: currentSettings }) => {
    if (!isOwner) {
        return await conn.sendMessage(from, {
            text: fancy("🚫 Owner only command!")
        });
    }

    const subcommand = args[0]?.toLowerCase();
    
    if (!subcommand) {
        // Show settings menu
        let menu = `╭─── • 🥀 • ───╮\n   SETTINGS MENU\n╰─── • 🥀 • ───╯\n\n`;
        
        menu += `📊 Current Settings:\n`;
        menu += `├ 🔗 Antilink: ${currentSettings.antilink ? 'ON' : 'OFF'}\n`;
        menu += `├ 🚫 Antiporn: ${currentSettings.antiporn ? 'ON' : 'OFF'}\n`;
        menu += `├ ⚠️ Antiscam: ${currentSettings.antiscam ? 'ON' : 'OFF'}\n`;
        menu += `├ 📷 Antimedia: ${currentSettings.antimedia}\n`;
        menu += `├ #️⃣ Antitag: ${currentSettings.antitag ? 'ON' : 'OFF'}\n`;
        menu += `├ 👁️ Antiviewonce: ${currentSettings.antiviewonce ? 'ON' : 'OFF'}\n`;
        menu += `├ 🗑️ Antidelete: ${currentSettings.antidelete ? 'ON' : 'OFF'}\n`;
        menu += `├ 💤 Sleeping Mode: ${currentSettings.sleepingMode ? 'ON' : 'OFF'}\n`;
        menu += `├ 🤖 Chatbot: ${currentSettings.chatbot ? 'ON' : 'OFF'}\n`;
        menu += `├ 📞 Anticall: ${currentSettings.anticall ? 'ON' : 'OFF'}\n`;
        menu += `└ 🔒 Work Mode: ${currentSettings.workMode}\n\n`;
        
        menu += `⚙️ Usage:\n`;
        menu += `• ${config.prefix}settings on/off [feature]\n`;
        menu += `• ${config.prefix}settings list\n`;
        menu += `• ${config.prefix}settings set [feature] [value]\n`;
        menu += `• ${config.prefix}settings reset\n\n`;
        
        menu += `📋 Features: antilink, antiporn, antiscam, antimedia, antitag, antiviewonce, antidelete, sleepingmode, welcome, chatbot, autocall, autobio, autoreact, autosave, autostatus, downloadstatus, antibug, antispam\n`;
        
        return await conn.sendMessage(from, { text: fancy(menu) });
    }
    
    if (subcommand === 'on' || subcommand === 'off') {
        const feature = args[1]?.toLowerCase();
        const value = subcommand === 'on';
        
        if (!feature) {
            return await conn.sendMessage(from, {
                text: fancy(`Specify feature! Example: ${config.prefix}settings on antilink`)
            });
        }
        
        const validFeatures = [
            'antilink', 'antiporn', 'antiscam', 'antitag', 'antiviewonce', 
            'antidelete', 'sleepingmode', 'welcome', 'chatbot', 'anticall',
            'autobio', 'autoreact', 'autosave', 'autostatus', 'downloadstatus',
            'antibug', 'antispam', 'activeMembers', 'autoblockCountry'
        ];
        
        if (!validFeatures.includes(feature)) {
            return await conn.sendMessage(from, {
                text: fancy(`Invalid feature! Valid: ${validFeatures.join(', ')}`)
            });
        }
        
        // Update setting
        currentSettings[feature] = value;
        await currentSettings.save();
        
        return await conn.sendMessage(from, {
            text: fancy(`✅ ${feature} turned ${subcommand.toUpperCase()}`)
        });
    }
    
    if (subcommand === 'list') {
        let list = `╭─── • 🥀 • ───╮\n   ALL FEATURES\n╰─── • 🥀 • ───╯\n\n`;
        
        const features = [
            { name: '🔗 Antilink', desc: 'Block links in groups', value: currentSettings.antilink },
            { name: '🚫 Antiporn', desc: 'Block adult content', value: currentSettings.antiporn },
            { name: '⚠️ Antiscam', desc: 'Detect scam messages', value: currentSettings.antiscam },
            { name: '📷 Antimedia', desc: 'Control media sending', value: currentSettings.antimedia },
            { name: '#️⃣ Antitag', desc: 'Prevent mass tagging', value: currentSettings.antitag },
            { name: '👁️ Antiviewonce', desc: 'Capture view once', value: currentSettings.antiviewonce },
            { name: '🗑️ Antidelete', desc: 'Detect deleted messages', value: currentSettings.antidelete },
            { name: '💤 Sleeping Mode', desc: 'Auto close groups', value: currentSettings.sleepingMode },
            { name: '👋 Welcome/Goodbye', desc: 'Greet members', value: currentSettings.welcomeGoodbye },
            { name: '🤖 Chatbot', desc: 'AI responses', value: currentSettings.chatbot },
            { name: '📞 Anticall', desc: 'Block calls', value: currentSettings.anticall },
            { name: '🤳 Auto Status', desc: 'Auto interact with status', value: currentSettings.autoStatus.view },
            { name: '👀 Auto Read', desc: 'Auto read messages', value: currentSettings.autoRead },
            { name: '❤️ Auto React', desc: 'Auto react to messages', value: currentSettings.autoReact },
            { name: '💾 Auto Save', desc: 'Auto save contacts', value: currentSettings.autoSave },
            { name: '📝 Auto Bio', desc: 'Auto update bio', value: currentSettings.autoBio },
            { name: '📥 Download Status', desc: 'Download statuses', value: currentSettings.downloadStatus },
            { name: '🐛 Antibug', desc: 'Block malicious messages', value: currentSettings.antibug },
            { name: '📢 Antispam', desc: 'Prevent spamming', value: currentSettings.antispam },
            { name: '👥 Active Members', desc: 'Track active members', value: currentSettings.activeMembers },
            { name: '🌍 Autoblock Country', desc: 'Block by country', value: currentSettings.autoblockCountry },
            { name: '👑 Work Mode', desc: 'Bot accessibility', value: currentSettings.workMode }
        ];
        
        features.forEach(feat => {
            list += `${feat.name}: ${feat.value ? '🟢 ON' : '🔴 OFF'}\n`;
        });
        
        return await conn.sendMessage(from, { text: fancy(list) });
    }
    
    if (subcommand === 'set') {
        const feature = args[1];
        const value = args[2];
        
        if (!feature || !value) {
            return await conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}settings set [feature] [value]\nExample: ${config.prefix}settings set antimedia all`)
            });
        }
        
        // Handle specific settings
        switch(feature.toLowerCase()) {
            case 'antimedia':
                if (['all', 'photo', 'video', 'sticker', 'audio', 'off'].includes(value.toLowerCase())) {
                    currentSettings.antimedia = value.toLowerCase();
                    await currentSettings.save();
                    return await conn.sendMessage(from, {
                        text: fancy(`✅ Antimedia set to: ${value}`)
                    });
                }
                break;
                
            case 'workmode':
                if (['public', 'private'].includes(value.toLowerCase())) {
                    currentSettings.workMode = value.toLowerCase();
                    await currentSettings.save();
                    return await conn.sendMessage(from, {
                        text: fancy(`✅ Work Mode set to: ${value}`)
                    });
                }
                break;
                
            case 'prefix':
                if (value.length === 1) {
                    currentSettings.commandPrefix = value;
                    await currentSettings.save();
                    return await conn.sendMessage(from, {
                        text: fancy(`✅ Command prefix set to: ${value}`)
                    });
                }
                break;
                
            default:
                return await conn.sendMessage(from, {
                    text: fancy(`Feature "${feature}" cannot be set with value. Use on/off.`)
                });
        }
    }
    
    if (subcommand === 'reset') {
        // Reset to defaults
        await Settings.deleteMany({});
        const newSettings = new Settings();
        await newSettings.save();
        
        return await conn.sendMessage(from, {
            text: fancy('✅ All settings reset to defaults!')
        });
    }
    
    // Show help
    await conn.sendMessage(from, {
        text: fancy(`Invalid subcommand. Use:\n${config.prefix}settings on/off [feature]\n${config.prefix}settings list\n${config.prefix}settings set [feature] [value]\n${config.prefix}settings reset`)
    });
};
