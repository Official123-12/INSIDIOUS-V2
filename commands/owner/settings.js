const handler = require('../../handler');

module.exports = {
    name: "settings",
    aliases: ["setting", "config"],
    ownerOnly: true,
    description: "Manage ALL bot features (global settings)",
    usage: "[feature] [value]",
    
    execute: async (conn, msg, args, { from, fancy, config, isOwner, reply }) => {
        if (!isOwner) 
            return reply("❌ This command is for owner only!");

        // Load current settings from handler
        let settings = await handler.loadSettings();

        // -------------------- SHOW ALL SETTINGS (FULL LIST) --------------------
        if (args.length === 0) {
            let text = `╭─── • 🥀 • ───╮\n`;
            text += `   *GLOBAL SETTINGS*  \n`;
            text += `╰─── • 🥀 • ───╯\n\n`;

            text += `🔧 *ANTI / SECURITY FEATURES*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 🛡️ antilink      : ${settings.antilink ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🔞 antiporn      : ${settings.antiporn ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 💰 antiscam      : ${settings.antiscam ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 📎 antimedia     : ${settings.antimedia ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🏷️ antitag       : ${settings.antitag ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 👁️ antiviewonce  : ${settings.antiviewonce ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🗑️ antidelete    : ${settings.antidelete ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 💤 sleepingmode  : ${settings.sleepingmode ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🐞 antibugs      : ${settings.antibugs ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🚫 antispam      : ${settings.antispam ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 📞 anticall      : ${settings.anticall ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `⚡ *AUTO FEATURES*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 👀 autoRead      : ${settings.autoRead ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ ❤️ autoReact     : ${settings.autoReact ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ ⌨️ autoTyping    : ${settings.autoTyping ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🎙️ autoRecording : ${settings.autoRecording ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 📝 autoBio       : ${settings.autoBio ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 📊 autostatus    : ${settings.autostatus ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 📥 downloadStatus: ${settings.downloadStatus ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `👥 *GROUP MANAGEMENT*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 🎉 welcomeGoodbye : ${settings.welcomeGoodbye ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 📈 activemembers  : ${settings.activemembers ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🌍 autoblockCountry: ${settings.autoblockCountry ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `🤖 *AI FEATURES*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 💬 chatbot       : ${settings.chatbot ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `⚙️ *THRESHOLDS & LIMITS*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ ⚠️ warnLimit      : ${settings.warnLimit}\n`;
            text += `│ 🏷️ maxTags        : ${settings.maxTags}\n`;
            text += `│ 💤 inactiveDays   : ${settings.inactiveDays}\n`;
            text += `│ 🚫 antiSpamLimit  : ${settings.antiSpamLimit} msg/${settings.antiSpamInterval/1000}s\n`;
            text += `│ 🕒 sleepingStart  : ${settings.sleepingStart}\n`;
            text += `│ 🕒 sleepingEnd    : ${settings.sleepingEnd}\n`;
            text += `└──────────────────────────\n\n`;

            text += `🔐 *PAIRING & MODE*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 👥 maxCoOwners   : ${settings.maxCoOwners}\n`;
            text += `│ 🤖 mode          : ${settings.mode === 'public' ? '🌍 PUBLIC' : '🔒 SELF'}\n`;
            text += `│ 📛 prefix        : ${settings.prefix || '.'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `💡 *USAGE:*\n`;
            text += `${config.prefix}settings <feature> [value]\n`;
            text += `📌 *Examples:*\n`;
            text += `  ${config.prefix}settings antilink on\n`;
            text += `  ${config.prefix}settings warnLimit 5\n`;
            text += `  ${config.prefix}settings mode public\n`;
            text += `  ${config.prefix}settings sleepingStart 22:00\n`;
            text += `  ${config.prefix}settings prefix !\n\n`;
            text += `_Settings are saved permanently._`;

            return reply(fancy(text));
        }

        // -------------------- TOGGLE / SET SPECIFIC FEATURE --------------------
        let feature = args[0].toLowerCase();
        const value = args.slice(1).join(' ').toLowerCase();

        // Normalize feature names (full mapping from handler.js)
        const featureMap = {
            // Anti features
            'antilink': 'antilink', 'anti-link': 'antilink',
            'antiporn': 'antiporn', 'anti-porn': 'antiporn',
            'antiscam': 'antiscam', 'anti-scam': 'antiscam',
            'antimedia': 'antimedia', 'anti-media': 'antimedia',
            'antitag': 'antitag', 'anti-tag': 'antitag',
            'antiviewonce': 'antiviewonce', 'anti-viewonce': 'antiviewonce', 'anti-view-once': 'antiviewonce',
            'antidelete': 'antidelete', 'anti-delete': 'antidelete',
            'sleepingmode': 'sleepingmode', 'sleep-mode': 'sleepingmode',
            'antibugs': 'antibugs', 'anti-bugs': 'antibugs',
            'antispam': 'antispam', 'anti-spam': 'antispam',
            'anticall': 'anticall', 'anti-call': 'anticall',
            
            // Auto features
            'autoread': 'autoRead', 'auto-read': 'autoRead',
            'autoreact': 'autoReact', 'auto-react': 'autoReact',
            'autotyping': 'autoTyping', 'auto-typing': 'autoTyping',
            'autorecording': 'autoRecording', 'auto-recording': 'autoRecording',
            'autobio': 'autoBio', 'auto-bio': 'autoBio',
            'autostatus': 'autostatus', 'auto-status': 'autostatus',
            'downloadstatus': 'downloadStatus', 'dlstatus': 'downloadStatus',
            
            // Group features
            'welcome': 'welcomeGoodbye', 'goodbye': 'welcomeGoodbye',
            'welcomegoodbye': 'welcomeGoodbye', 'welcome-goodbye': 'welcomeGoodbye',
            'activemembers': 'activemembers', 'active-members': 'activemembers',
            'autoblockcountry': 'autoblockCountry', 'auto-block-country': 'autoblockCountry',
            
            // AI
            'chatbot': 'chatbot', 'ai': 'chatbot',
            
            // Thresholds
            'warnlimit': 'warnLimit', 'warn-limit': 'warnLimit',
            'maxtags': 'maxTags', 'max-tags': 'maxTags',
            'inactivedays': 'inactiveDays', 'inactive-days': 'inactiveDays',
            'antispamlimit': 'antiSpamLimit', 'antispam-limit': 'antiSpamLimit',
            'antispaminterval': 'antiSpamInterval', 'antispam-interval': 'antiSpamInterval',
            'sleepingstart': 'sleepingStart', 'sleeping-start': 'sleepingStart',
            'sleepingend': 'sleepingEnd', 'sleeping-end': 'sleepingEnd',
            
            // Pairing & mode
            'maxcoowners': 'maxCoOwners', 'max-coowners': 'maxCoOwners',
            'mode': 'mode',
            'prefix': 'prefix'
        };

        if (featureMap[feature]) {
            feature = featureMap[feature];
        }

        // Check if feature exists in settings
        if (!(feature in settings)) {
            return reply(`❌ Feature "${args[0].toLowerCase()}" does not exist.\n📋 Use *${config.prefix}settings* to see the list.`);
        }

        // --- Handle different types of settings ---
        const oldValue = settings[feature];

        // 1. Boolean features (toggle on/off)
        if (typeof oldValue === 'boolean') {
            if (!value) {
                settings[feature] = !settings[feature]; // toggle
            } else if (['on', 'enable', 'true', '1'].includes(value)) {
                settings[feature] = true;
            } else if (['off', 'disable', 'false', '0'].includes(value)) {
                settings[feature] = false;
            } else {
                return reply(`❌ Invalid value. Use: on / off (or no value to toggle)`);
            }
        }
        
        // 2. Numeric features
        else if (typeof oldValue === 'number') {
            if (!value) return reply(`❌ Please provide a numeric value.`);
            const num = Number(value);
            if (isNaN(num)) return reply(`❌ Must be a number.`);
            // Special bounds
            if (feature === 'warnLimit' && (num < 1 || num > 10)) return reply(`❌ warnLimit must be between 1 and 10.`);
            if (feature === 'maxTags' && (num < 1 || num > 20)) return reply(`❌ maxTags must be between 1 and 20.`);
            if (feature === 'inactiveDays' && (num < 1 || num > 90)) return reply(`❌ inactiveDays must be between 1 and 90.`);
            if (feature === 'antiSpamLimit' && (num < 1 || num > 30)) return reply(`❌ antiSpamLimit must be between 1 and 30.`);
            if (feature === 'antiSpamInterval' && (num < 1000 || num > 60000)) return reply(`❌ antiSpamInterval must be between 1000 and 60000 ms.`);
            if (feature === 'maxCoOwners' && (num < 1 || num > 5)) return reply(`❌ maxCoOwners must be between 1 and 5.`);
            settings[feature] = num;
        }
        
        // 3. String features (mode, prefix, sleeping times)
        else if (typeof oldValue === 'string') {
            if (!value) return reply(`❌ Please provide a value.`);
            if (feature === 'mode') {
                if (!['public', 'self'].includes(value)) 
                    return reply(`❌ Mode must be 'public' or 'self'.`);
                settings.mode = value;
            } else if (feature === 'prefix') {
                if (value.length > 3) return reply(`❌ Prefix too long. Max 3 characters.`);
                settings.prefix = value;
            } else if (feature === 'sleepingStart' || feature === 'sleepingEnd') {
                if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value))
                    return reply(`❌ Invalid time format. Use HH:MM (24h).`);
                settings[feature] = value;
            } else {
                // generic string
                settings[feature] = value;
            }
        }
        
        // 4. Array features (not handled here – use separate commands)
        else if (Array.isArray(oldValue)) {
            return reply(`❌ Array settings (e.g., blockedCountries, scamKeywords) must be managed via dedicated commands.`);
        }
        
        else {
            return reply(`❌ Unsupported setting type.`);
        }

        // Save settings and refresh config
        await handler.saveSettings(settings);
        await handler.refreshConfig();

        // Prepare response status
        let statusDisplay;
        if (typeof settings[feature] === 'boolean') {
            statusDisplay = settings[feature] ? '✅ ON' : '❌ OFF';
        } else if (feature === 'mode') {
            statusDisplay = settings.mode === 'public' ? '🌍 PUBLIC' : '🔒 SELF';
        } else {
            statusDisplay = settings[feature];
        }

        let response = `✅ *Setting updated!*\n\n`;
        response += `🔧 Feature: *${feature}*\n`;
        response += `📊 Status: ${statusDisplay}\n\n`;
        response += `_Settings saved._`;

        await reply(fancy(response));
    }
};