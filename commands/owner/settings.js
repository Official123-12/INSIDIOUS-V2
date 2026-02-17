const handler = require('../../handler');

module.exports = {
    name: "settings",
    aliases: ["setting", "config"],
    ownerOnly: true,
    description: "Complete bot settings manager",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        const settings = await handler.loadGlobalSettings();
        const prefix = settings.prefix || '.';

        // ========== USER MANUAL (when no args) ==========
        if (args.length === 0) {
            let manual = `╭─── • 🥀 • ───╮\n`;
            manual += `   *⚙️ SETTINGS MANUAL*   \n`;
            manual += `╰─── • 🥀 • ───╯\n\n`;

            manual += `*🔧 BASIC COMMANDS*\n`;
            manual += `┌───────────────\n`;
            manual += `│ ${prefix}settings                      # Show this manual\n`;
            manual += `│ ${prefix}settings list                  # Show all current settings\n`;
            manual += `└───────────────\n\n`;

            manual += `*🔁 TOGGLE FEATURES (on/off)*\n`;
            manual += `┌────────────────\n`;
            manual += `│ ${prefix}settings <feature> on/off\n`;
            manual += `│ Example: ${prefix}settings antilink on\n`;
            manual += `│ Example: ${prefix}settings antiporn off\n`;
            manual += `└────────────────\n\n`;

            manual += `*🌐 TOGGLE WITH SCOPE (all/group/private)*\n`;
            manual += `┌───────────────\n`;
            manual += `│ For features that support scope:\n`;
            manual += `│ • autoread\n`;
            manual += `│ • autoreact\n`;
            manual += `│ • chatbot\n`;
            manual += `│ • antiviewonce\n`;
            manual += `│ • antidelete\n`;
            manual += `│\n`;
            manual += `│ ${prefix}settings <feature> <scope> on/off\n`;
            manual += `│ Example: ${prefix}settings autoreact group on\n`;
            manual += `│ Example: ${prefix}settings autoread all off\n`;
            manual += `└───────────────\n\n`;

            manual += `*🔢 SET NUMERIC VALUES*\n`;
            manual += `┌───────────────\n`;
            manual += `│ ${prefix}settings set <feature> <value>\n`;
            manual += `│ Features: warnLimit, maxTags, inactiveDays, antiSpamLimit,\n`;
            manual += `│           antiSpamInterval, sleepingStart, sleepingEnd,\n`;
            manual += `│           maxCoOwners, autoStatusLimit, autoDeleteTimeout\n`;
            manual += `│ Example: ${prefix}settings set warnLimit 5\n`;
            manual += `│ Example: ${prefix}settings set sleepingStart 22:00\n`;
            manual += `└───────────────\n\n`;

            manual += `*📋 MANAGE ARRAYS (keywords, emojis, countries)*\n`;
            manual += `┌───────────────\n`;
            manual += `│ Available arrays:\n`;
            manual += `│ • scam       (scam keywords)\n`;
            manual += `│ • porn       (porn keywords)\n`;
            manual += `│ • blockmedia (blocked media types: photo, video, sticker, etc.)\n`;
            manual += `│ • emoji      (auto-react emojis)\n`;
            manual += `│ • country    (blocked country codes)\n`;
            manual += `│\n`;
            manual += `│ ${prefix}settings list <array>                # Show all items\n`;
            manual += `│ ${prefix}settings add <array> <item>          # Add an item\n`;
            manual += `│ ${prefix}settings remove <array> <item>       # Remove an item\n`;
            manual += `│\n`;
            manual += `│ Examples:\n`;
            manual += `│ ${prefix}settings list scam\n`;
            manual += `│ ${prefix}settings add scam win\n`;
            manual += `│ ${prefix}settings remove scam win\n`;
            manual += `└───────────────\n\n`;

            manual += `*⚙️ OTHER SETTINGS*\n`;
            manual += `┌───────────────\n`;
            manual += `│ autoDeleteMessages: ${settings.autoDeleteMessages ? '✅' : '❌'}\n`;
            manual += `│ autoDeleteTimeout: ${settings.autoDeleteTimeout}ms\n`;
            manual += `│ autoStatusActions: ${settings.autoStatusActions?.join(', ') || 'view,react,reply'}\n`;
            manual += `│\n`;
            manual += `│ ${prefix}settings autodelete on/off\n`;
            manual += `│ ${prefix}settings set autoDeleteTimeout <ms>\n`;
            manual += `│ ${prefix}settings statusactions <view/react/reply> ...\n`;
            manual += `└───────────────\n\n`;

            manual += `*📊 VIEW CURRENT SETTINGS*\n`;
            manual += `┌───────────────\n`;
            manual += `│ ${prefix}settings list\n`;
            manual += `└───────────────\n`;

            await conn.sendMessage(from, {
                image: { url: settings.botImage || 'https://files.catbox.moe/f3c07u.jpg' },
                caption: fancy(manual),
                contextInfo: { isForwarded: true }
            }, { quoted: msg });
            return;
        }

        // ========== SHOW ALL SETTINGS (when first arg is "list") ==========
        if (args[0].toLowerCase() === 'list' && args.length === 1) {
            let text = `╭─── • 🥀 • ───╮\n`;
            text += `   *CURRENT SETTINGS*   \n`;
            text += `╰─── • 🥀 • ───╯\n\n`;

            text += `🔧 *ANTI FEATURES*\n`;
            text += `┌───────────\n`;
            text += `│ antilink       : ${settings.antilink ? '✅' : '❌'}\n`;
            text += `│ antiporn       : ${settings.antiporn ? '✅' : '❌'}\n`;
            text += `│ antiscam       : ${settings.antiscam ? '✅' : '❌'}\n`;
            text += `│ antimedia      : ${settings.antimedia ? '✅' : '❌'}\n`;
            text += `│ antitag        : ${settings.antitag ? '✅' : '❌'}\n`;
            text += `│ antiviewonce   : ${settings.antiviewonce ? '✅' : '❌'} (scope: ${settings.antiviewonceScope || 'all'})\n`;
            text += `│ antidelete     : ${settings.antidelete ? '✅' : '❌'} (scope: ${settings.antideleteScope || 'all'})\n`;
            text += `│ sleepingmode   : ${settings.sleepingmode ? '✅' : '❌'}\n`;
            text += `│ antispam       : ${settings.antispam ? '✅' : '❌'}\n`;
            text += `│ anticall       : ${settings.anticall ? '✅' : '❌'}\n`;
            text += `└───────────\n\n`;

            text += `⚡ *AUTO FEATURES*\n`;
            text += `┌───────────\n`;
            text += `│ autoRead       : ${settings.autoRead ? '✅' : '❌'} (scope: ${settings.autoReadScope || 'all'})\n`;
            text += `│ autoReact      : ${settings.autoReact ? '✅' : '❌'} (scope: ${settings.autoReactScope || 'all'})\n`;
            text += `│ autoTyping     : ${settings.autoTyping ? '✅' : '❌'}\n`;
            text += `│ autoRecording  : ${settings.autoRecording ? '✅' : '❌'}\n`;
            text += `│ autoBio        : ${settings.autoBio ? '✅' : '❌'}\n`;
            text += `│ autostatus     : ${settings.autostatus ? '✅' : '❌'} (limit: ${settings.autoStatusLimit}/day)\n`;
            text += `│ downloadStatus : ${settings.downloadStatus ? '✅' : '❌'}\n`;
            text += `└───────────\n\n`;

            text += `🤖 *CHATBOT*\n`;
            text += `┌───────────\n`;
            text += `│ chatbot        : ${settings.chatbot ? '✅' : '❌'} (scope: ${settings.chatbotScope || 'all'})\n`;
            text += `└────────────n\n`;

            text += `👥 *GROUP MANAGEMENT*\n`;
            text += `┌───────────\n`;
            text += `│ welcomeGoodbye : ${settings.welcomeGoodbye ? '✅' : '❌'}\n`;
            text += `│ activemembers  : ${settings.activemembers ? '✅' : '❌'}\n`;
            text += `│ autoblockCountry: ${settings.autoblockCountry ? '✅' : '❌'}\n`;
            text += `└───────────\n\n`;

            text += `⚙️ *LIMITS*\n`;
            text += `┌───────────\n`;
            text += `│ warnLimit      : ${settings.warnLimit}\n`;
            text += `│ maxTags        : ${settings.maxTags}\n`;
            text += `│ inactiveDays   : ${settings.inactiveDays}\n`;
            text += `│ antiSpamLimit  : ${settings.antiSpamLimit}\n`;
            text += `│ antiSpamInterval: ${settings.antiSpamInterval}ms\n`;
            text += `│ sleepingStart  : ${settings.sleepingStart}\n`;
            text += `│ sleepingEnd    : ${settings.sleepingEnd}\n`;
            text += `│ maxCoOwners    : ${settings.maxCoOwners}\n`;
            text += `│ autoStatusLimit: ${settings.autoStatusLimit}\n`;
            text += `└────────────\n\n`;

            text += `🔐 *MODE & PREFIX*\n`;
            text += `┌───────────\n`;
            text += `│ mode           : ${settings.mode}\n`;
            text += `│ prefix         : ${settings.prefix}\n`;
            text += `│ alwaysOnline   : ${settings.alwaysOnline ? '✅' : '❌'}\n`;
            text += `└───────────\n\n`;

            text += `⚙️ *OTHER SETTINGS*\n`;
            text += `┌───────────\n`;
            text += `│ autoDeleteMessages: ${settings.autoDeleteMessages ? '✅' : '❌'}\n`;
            text += `│ autoDeleteTimeout : ${settings.autoDeleteTimeout}ms\n`;
            text += `│ autoStatusActions : ${settings.autoStatusActions?.join(', ') || 'view,react,reply'}\n`;
            text += `└───────────\n`;

            text += `📋 *ARRAY SETTINGS*\n`;
            text += `┌────────────\n`;
            text += `│ scamKeywords   : ${settings.scamKeywords?.length || 0} items\n`;
            text += `│ pornKeywords   : ${settings.pornKeywords?.length || 0} items\n`;
            text += `│ blockedMediaTypes: ${settings.blockedMediaTypes?.length || 0} items\n`;
            text += `│ autoReactEmojis: ${settings.autoReactEmojis?.length || 0} items\n`;
            text += `│ blockedCountries: ${settings.blockedCountries?.length || 0} items\n`;
            text += `└───────────\n`;

            await conn.sendMessage(from, {
                image: { url: settings.botImage || 'https://files.catbox.moe/f3c07u.jpg' },
                caption: fancy(text),
                contextInfo: { isForwarded: true }
            }, { quoted: msg });
            return;
        }

        // ========== SPECIAL SETTINGS ==========
        const first = args[0].toLowerCase();

        if (first === 'autodelete') {
            if (args.length < 2) return reply("❌ Usage: .settings autodelete on/off");
            const action = args[1].toLowerCase();
            if (!['on', 'off'].includes(action)) return reply("❌ Specify on or off.");
            settings.autoDeleteMessages = action === 'on';
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ Auto-delete messages is now ${action.toUpperCase()}`);
        }

        if (first === 'statusactions') {
            if (args.length < 2) return reply("❌ Usage: .settings statusactions view/react/reply ...");
            const actions = args.slice(1).map(a => a.toLowerCase());
            const valid = ['view', 'react', 'reply'];
            if (!actions.every(a => valid.includes(a))) return reply(`❌ Valid actions: ${valid.join(', ')}`);
            settings.autoStatusActions = actions;
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ Auto status actions set to: ${actions.join(', ')}`);
        }

        // ========== PARSE ARGUMENTS ==========
        const subcommands = ['set', 'list', 'add', 'remove'];

        if (subcommands.includes(first)) {
            const sub = first;

            if (sub === 'set') {
                const feature = args[1];
                const value = args.slice(2).join(' ');
                if (!feature || !value) return reply("❌ Usage: .settings set <feature> <value>");
                if (!(feature in settings)) return reply(`❌ Feature '${feature}' not found.`);

                if (typeof settings[feature] === 'number') {
                    const num = Number(value);
                    if (isNaN(num)) return reply("❌ Must be a number.");
                    settings[feature] = num;
                } else if (typeof settings[feature] === 'string') {
                    settings[feature] = value;
                } else {
                    return reply("❌ Cannot set this feature. Use toggle or array commands.");
                }
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ ${feature} set to ${settings[feature]}`);
            }

            if (sub === 'list') {
                const arrayName = args[1];
                const validArrays = ['scam', 'porn', 'blockmedia', 'emoji', 'country'];
                const map = {
                    scam: 'scamKeywords',
                    porn: 'pornKeywords',
                    blockmedia: 'blockedMediaTypes',
                    emoji: 'autoReactEmojis',
                    country: 'blockedCountries'
                };
                if (!validArrays.includes(arrayName)) return reply(`❌ Valid arrays: ${validArrays.join(', ')}`);

                const key = map[arrayName];
                const list = settings[key] || [];
                // Build plain list without borders – reply will add borders
                let text = `*${key.toUpperCase()}*\n\n`;
                text += `Total: ${list.length}\n\n`;
                list.forEach((item, i) => { text += `${i+1}. ${item}\n`; });
                return reply(text);
            }

            if (sub === 'add') {
                const arrayName = args[1];
                const item = args.slice(2).join(' ').trim();
                const validArrays = ['scam', 'porn', 'blockmedia', 'emoji', 'country'];
                const map = {
                    scam: 'scamKeywords',
                    porn: 'pornKeywords',
                    blockmedia: 'blockedMediaTypes',
                    emoji: 'autoReactEmojis',
                    country: 'blockedCountries'
                };
                if (!validArrays.includes(arrayName)) return reply(`❌ Valid arrays: ${validArrays.join(', ')}`);
                if (!item) return reply("❌ Provide item to add.");

                const key = map[arrayName];
                let list = settings[key] || [];
                if (list.includes(item)) return reply("❌ Item already exists.");
                list.push(item);
                settings[key] = list;
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ Added to ${key}: ${item}`);
            }

            if (sub === 'remove') {
                const arrayName = args[1];
                const item = args.slice(2).join(' ').trim();
                const validArrays = ['scam', 'porn', 'blockmedia', 'emoji', 'country'];
                const map = {
                    scam: 'scamKeywords',
                    porn: 'pornKeywords',
                    blockmedia: 'blockedMediaTypes',
                    emoji: 'autoReactEmojis',
                    country: 'blockedCountries'
                };
                if (!validArrays.includes(arrayName)) return reply(`❌ Valid arrays: ${validArrays.join(', ')}`);
                if (!item) return reply("❌ Provide item to remove.");

                const key = map[arrayName];
                let list = settings[key] || [];
                const index = list.indexOf(item);
                if (index === -1) return reply("❌ Item not found.");
                list.splice(index, 1);
                settings[key] = list;
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ Removed from ${key}: ${item}`);
            }
        }

        // ========== TOGGLE FEATURE (with optional scope) ==========
        const featureMap = {
            'antilink': 'antilink',
            'antiporn': 'antiporn',
            'antiscam': 'antiscam',
            'antimedia': 'antimedia',
            'antitag': 'antitag',
            'antiviewonce': 'antiviewonce',
            'antidelete': 'antidelete',
            'sleepingmode': 'sleepingmode',
            'antispam': 'antispam',
            'anticall': 'anticall',
            'autoread': 'autoRead',
            'autoreact': 'autoReact',
            'autotyping': 'autoTyping',
            'autorecording': 'autoRecording',
            'autobio': 'autoBio',
            'autostatus': 'autostatus',
            'downloadstatus': 'downloadStatus',
            'chatbot': 'chatbot',
            'welcomegoodbye': 'welcomeGoodbye',
            'activemembers': 'activemembers',
            'autoblockcountry': 'autoblockCountry',
            'alwaysonline': 'alwaysOnline',
            'autodeletemessages': 'autoDeleteMessages'
        };

        let feature = first;
        if (featureMap[feature]) {
            feature = featureMap[feature];
        }

        let scope = null;
        let action = null;
        const possibleScopes = ['all', 'group', 'private'];

        if (args.length >= 3 && possibleScopes.includes(args[1].toLowerCase())) {
            scope = args[1].toLowerCase();
            action = args[2].toLowerCase();
        } else if (args.length >= 2) {
            action = args[1].toLowerCase();
        } else {
            return reply("❌ Invalid format. Use: .settings <feature> [scope] on/off");
        }

        if (!action || !['on', 'off'].includes(action)) {
            return reply("❌ Please specify 'on' or 'off'.");
        }

        if (!(feature in settings)) {
            return reply(`❌ Feature '${feature}' not found.`);
        }

        const scopeFeatures = ['autoRead', 'autoReact', 'chatbot', 'antiviewonce', 'antidelete'];
        const scopeKey = feature + 'Scope';

        if (scopeFeatures.includes(feature)) {
            if (!scope) {
                if (typeof settings[feature] !== 'boolean') {
                    return reply(`❌ '${feature}' is not a boolean.`);
                }
                settings[feature] = action === 'on';
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ ${feature} is now ${action.toUpperCase()} (scope: ${settings[scopeKey] || 'all'})`);
            } else {
                if (!possibleScopes.includes(scope)) {
                    return reply("❌ Scope must be 'all', 'group', or 'private'.");
                }
                settings[feature] = action === 'on';
                settings[scopeKey] = scope;
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ ${feature} is now ${action.toUpperCase()} (scope: ${scope})`);
            }
        } else {
            if (scope) {
                return reply(`❌ '${feature}' does not support scope. Use just on/off.`);
            }
            if (typeof settings[feature] !== 'boolean') {
                return reply(`❌ '${feature}' is not a boolean.`);
            }
            settings[feature] = action === 'on';
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ ${feature} is now ${action.toUpperCase()}`);
        }
    }
};