const handler = require('../../handler');

module.exports = {
    name: "settings",
    aliases: ["setting", "config"],
    ownerOnly: true,
    description: "Manage ALL bot features (toggle on/off)",
    usage: "[feature] [on/off/public/self/number]",
    
    execute: async (conn, msg, args, { from, fancy, config, isOwner, reply }) => {
        if (!isOwner) 
            return reply("❌ This command is for owner only!");

        // Load current settings from handler
        let settings = await handler.loadSettings();

        // -------------------- SHOW ALL SETTINGS (FULL LIST) --------------------
        if (args.length === 0) {
            let text = `╭─── • 🥀 • ───╮\n`;
            text += `   *BOT SETTINGS*  \n`;
            text += `╰─── • 🥀 • ───╯\n\n`;

            text += `🔧 *ANTI FEATURES*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 🛡️ antilink      : ${settings.antilink ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🔞 antiporn      : ${settings.antiporn ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 💰 antiscam      : ${settings.antiscam ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🏷️ antitag       : ${settings.antitag ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 👁️ antiviewonce  : ${settings.antiviewonce ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🗑️ antidelete    : ${settings.antidelete ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `⚡ *AUTO FEATURES*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 👀 autoRead      : ${settings.autoRead ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ ❤️ autoReact     : ${settings.autoReact ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ ⌨️ autoTyping    : ${settings.autoTyping ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 🎙️ autoRecording : ${settings.autoRecording ? '✅ ON' : '❌ OFF'}\n`;
            text += `│ 📝 autoBio       : ${settings.autoBio ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `👥 *GROUP FEATURES*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 🎉 welcomeGoodbye : ${settings.welcomeGoodbye ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `🤖 *AI FEATURES*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 💬 chatbot       : ${settings.chatbot ? '✅ ON' : '❌ OFF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `🔐 *PAIRING SYSTEM*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 👥 maxCoOwners   : ${settings.maxCoOwners}\n`;
            text += `└──────────────────────────\n\n`;

            text += `🌐 *BOT MODE*\n`;
            text += `┌──────────────────────────\n`;
            text += `│ 🤖 mode         : ${settings.mode === 'public' ? '🌍 PUBLIC' : '🔒 SELF'}\n`;
            text += `└──────────────────────────\n\n`;

            text += `💡 *USAGE:*\n`;
            text += `${config.prefix}settings <feature> [on/off/public/self/number]\n`;
            text += `📌 *Examples:*\n`;
            text += `  ${config.prefix}settings antilink on\n`;
            text += `  ${config.prefix}settings autoReact off\n`;
            text += `  ${config.prefix}settings mode public\n`;
            text += `  ${config.prefix}settings maxCoOwners 3\n\n`;
            text += `_Settings are saved permanently._`;

            return reply(fancy(text));
        }

        // -------------------- TOGGLE SPECIFIC FEATURE --------------------
        let feature = args[0].toLowerCase();
        const value = args[1]?.toLowerCase();

        // Normalize feature names (handle common aliases)
        const featureMap = {
            // Anti features
            'antilink': 'antilink',
            'anti-link': 'antilink',
            'antiporn': 'antiporn',
            'anti-porn': 'antiporn',
            'antiscam': 'antiscam',
            'anti-scam': 'antiscam',
            'antitag': 'antitag',
            'anti-tag': 'antitag',
            'antiviewonce': 'antiviewonce',
            'anti-viewonce': 'antiviewonce',
            'anti-view-once': 'antiviewonce',
            'antidelete': 'antidelete',
            'anti-delete': 'antidelete',
            
            // Auto features
            'autoread': 'autoRead',
            'auto-read': 'autoRead',
            'autoreact': 'autoReact',
            'auto-react': 'autoReact',
            'autotyping': 'autoTyping',
            'auto-typing': 'autoTyping',
            'autorecording': 'autoRecording',
            'auto-recording': 'autoRecording',
            'autobio': 'autoBio',
            'auto-bio': 'autoBio',
            
            // Group features
            'welcome': 'welcomeGoodbye',
            'goodbye': 'welcomeGoodbye',
            'welcomegoodbye': 'welcomeGoodbye',
            'welcome-goodbye': 'welcomeGoodbye',
            
            // AI features
            'chatbot': 'chatbot',
            'ai': 'chatbot',
            
            // Pairing
            'maxcoowners': 'maxCoOwners',
            'max-coowners': 'maxCoOwners',
            'maxowners': 'maxCoOwners',
            
            // Mode
            'mode': 'mode'
        };

        // Map to correct feature name
        if (featureMap[feature]) {
            feature = featureMap[feature];
        }

        // Handle numeric feature (maxCoOwners)
        if (feature === 'maxCoOwners') {
            const num = parseInt(args[1]);
            if (isNaN(num) || num < 1 || num > 5) 
                return reply(`❌ Max co‑owners must be between 1 and 5.`);
            settings.maxCoOwners = num;
        }
        // Handle mode (public/self)
        else if (feature === 'mode') {
            if (value === 'public' || value === 'self') {
                settings.mode = value;
            } else if (!value) {
                settings.mode = settings.mode === 'public' ? 'self' : 'public';
            } else {
                return reply(`❌ Invalid mode. Use: public / self`);
            }
        }
        // Handle boolean features
        else {
            if (!(feature in settings)) {
                return reply(`❌ Feature "${args[0].toLowerCase()}" does not exist.\n📋 Use *${config.prefix}settings* to see the list.`);
            }
            if (!value) {
                settings[feature] = !settings[feature]; // toggle
            } else if (['on', 'enable', 'true', '1'].includes(value)) {
                settings[feature] = true;
            } else if (['off', 'disable', 'false', '0'].includes(value)) {
                settings[feature] = false;
            } else {
                return reply(`❌ Invalid value. Use: on / off`);
            }
        }

        // Save settings and refresh config
        await handler.saveSettings(settings);
        await handler.refreshConfig();

        // Prepare response status
        let status;
        if (feature === 'mode') {
            status = settings.mode === 'public' ? '🌍 PUBLIC' : '🔒 SELF';
        } else if (feature === 'maxCoOwners') {
            status = settings.maxCoOwners;
        } else {
            status = settings[feature] ? '✅ ON' : '❌ OFF';
        }

        let response = `✅ *Setting updated!*\n\n`;
        response += `🔧 Feature: *${feature}*\n`;
        response += `📊 Status: ${status}\n\n`;
        response += `_Settings saved._`;

        await reply(fancy(response));
    }
};
