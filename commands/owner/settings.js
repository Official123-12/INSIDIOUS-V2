const handler = require('../../handler');

module.exports = {
    name: "settings",
    aliases: ["setting", "config"],
    ownerOnly: true,
    description: "Complete bot settings manager – all in one",
    
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
            manual += `┌───────────────\n`;
            manual += `│ ${prefix}settings <feature> on/off\n`;
            manual += `│ Example: ${prefix}settings antilink on\n`;
            manual += `│ Example: ${prefix}settings antiporn off\n`;
            manual += `└───────────────\n\n`;

            manual += `*🌐 WHERE TO USE (all/group/private)*\n`;
            manual += `┌───────────────\n`;
            manual += `│ ${prefix}settings where <feature> <all/group/private>\n`;
            manual += `│ Features: autoRead, autoReact, chatbot, antiviewonce, antidelete\n`;
            manual += `│ Example: ${prefix}settings where autoReact group\n`;
            manual += `│ Example: ${prefix}settings where autoRead all\n`;
            manual += `└───────────────\n\n`;

            manual += `*🔢 SET NUMERIC VALUES*\n`;
            manual += `┌───────────────\n`;
            manual += `│ ${prefix}settings set <feature> <value>\n`;
            manual += `│ Features: warnLimit, maxTags, inactiveDays, antiSpamLimit,\n`;
            manual += `│           antiSpamInterval, sleepingStart, sleepingEnd,\n`;
            manual += `│           maxCoOwners, statusReplyLimit, autoExpireMinutes\n`;
            manual += `│ Example: ${prefix}settings set warnLimit 5\n`;
            manual += `│ Example: ${prefix}settings set sleepingStart 22:00\n`;
            manual += `└───────────────\n\n`;

            manual += `*📋 MANAGE LISTS*\n`;
            manual += `┌───────────────\n`;
            manual += `│ Available lists:\n`;
            manual += `│ • scam       (scam keywords)\n`;
            manual += `│ • porn       (porn keywords)\n`;
            manual += `│ • blockmedia (blocked media types: photo, video, sticker)\n`;
            manual += `│ • emoji      (auto-react emojis)\n`;
            manual += `│ • country    (blocked country codes)\n`;
            manual += `│\n`;
            manual += `│ ${prefix}settings list <list>                # Show all items\n`;
            manual += `│ ${prefix}settings add <list> <item>          # Add an item\n`;
            manual += `│ ${prefix}settings remove <list> <item>       # Remove an item\n`;
            manual += `│ Example: ${prefix}settings add scam win\n`;
            manual += `└───────────────\n\n`;

            manual += `*⚙️ OTHER SETTINGS*\n`;
            manual += `┌───────────────\n`;
            manual += `│ autoDeleteMessages: ${settings.autoDeleteMessages ? '✅' : '❌'}\n`;
            manual += `│ autoExpireMinutes : ${settings.autoExpireMinutes} minutes\n`;
            manual += `│ autoStatusActions : ${settings.autoStatusActions?.join(', ') || 'view,react,reply'}\n`;
            manual += `│\n`;
            manual += `│ ${prefix}settings autodelete on/off\n`;
            manual += `│ ${prefix}settings set autoExpireMinutes <minutes>\n`;
            manual += `│ ${prefix}settings statusactions <view/react/reply> ...\n`;
            manual += `│ ${prefix}settings mode public/self\n`;
            manual += `│ ${prefix}settings prefix <new>\n`;
            manual += `│ ${prefix}settings withoutprefix on/off\n`;
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
            text += `│ antiviewonce   : ${settings.antiviewonce ? '✅' : '❌'} (where: ${settings.antiviewonceScope || 'all'})\n`;
            text += `│ antidelete     : ${settings.antidelete ? '✅' : '❌'} (where: ${settings.antideleteScope || 'all'})\n`;
            text += `│ sleepingmode   : ${settings.sleepingmode ? '✅' : '❌'}\n`;
            text += `│ antispam       : ${settings.antispam ? '✅' : '❌'}\n`;
            text += `│ anticall       : ${settings.anticall ? '✅' : '❌'}\n`;
            text += `└───────────\n\n`;

            text += `⚡ *AUTO FEATURES*\n`;
            text += `┌───────────\n`;
            text += `│ autoRead       : ${settings.autoRead ? '✅' : '❌'} (where: ${settings.autoReadScope || 'all'})\n`;
            text += `│ autoReact      : ${settings.autoReact ? '✅' : '❌'} (where: ${settings.autoReactScope || 'all'})\n`;
            text += `│ autoTyping     : ${settings.autoTyping ? '✅' : '❌'}\n`;
            text += `│ autoRecording  : ${settings.autoRecording ? '✅' : '❌'}\n`;
            text += `│ autoBio        : ${settings.autoBio ? '✅' : '❌'}\n`;
            text += `│ autostatus     : ${settings.autostatus ? '✅' : '❌'} (limit: ${settings.statusReplyLimit}/day)\n`;
            text += `│ downloadStatus : ${settings.downloadStatus ? '✅' : '❌'}\n`;
            text += `│ autoDeleteMessages: ${settings.autoDeleteMessages ? '✅' : '❌'}\n`;
            text += `└───────────\n\n`;

            text += `🤖 *CHATBOT*\n`;
            text += `┌───────────\n`;
            text += `│ chatbot        : ${settings.chatbot ? '✅' : '❌'} (where: ${settings.chatbotScope || 'all'})\n`;
            text += `└───────────\n\n`;

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
            text += `│ statusReplyLimit: ${settings.statusReplyLimit}\n`;
            text += `│ autoExpireMinutes: ${settings.autoExpireMinutes}\n`;
            text += `└───────────\n\n`;

            text += `🔐 *MODE & PREFIX*\n`;
            text += `┌───────────\n`;
            text += `│ mode           : ${settings.mode}\n`;
            text += `│ prefix         : ${settings.prefix}\n`;
            text += `│ withoutPrefix  : ${settings.commandWithoutPrefix ? '✅' : '❌'}\n`;
            text += `└───────────\n\n`;

            text += `📋 *ARRAY SETTINGS*\n`;
            text += `┌───────────\n`;
            text += `│ scamKeywords   : ${settings.scamKeywords?.length || 0} items\n`;
            text += `│ pornKeywords   : ${settings.pornKeywords?.length || 0} items\n`;
            text += `│ blockedMedia   : ${settings.blockedMediaTypes?.length || 0} items\n`;
            text += `│ reactEmojis    : ${settings.autoReactEmojis?.length || 0} items\n`;
            text += `│ blockedCountries: ${settings.blockedCountries?.length || 0} items\n`;
            text += `└───────────\n`;

            await conn.sendMessage(from, {
                image: { url: settings.botImage || 'https://files.catbox.moe/f3c07u.jpg' },
                caption: fancy(text),
                contextInfo: { isForwarded: true }
            }, { quoted: msg });
            return;
        }

        // ========== PARSE ARGUMENTS ==========
        const first = args[0].toLowerCase();

        // ----- SPECIAL: autodelete -----
        if (first === 'autodelete') {
            if (args.length < 2) return reply("❌ Usage: .settings autodelete on/off");
            const action = args[1].toLowerCase();
            if (!['on', 'off'].includes(action)) return reply("❌ Use on or off.");
            settings.autoDeleteMessages = action === 'on';
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ Auto-delete messages is now ${action.toUpperCase()}`);
        }

        // ----- SPECIAL: statusactions -----
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

        // ----- SPECIAL: mode -----
        if (first === 'mode' && args.length === 2) {
            const mode = args[1].toLowerCase();
            if (!['public', 'self'].includes(mode)) return reply("❌ Mode must be public or self.");
            settings.mode = mode;
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ Mode set to ${mode}`);
        }

        // ----- SPECIAL: prefix -----
        if (first === 'prefix' && args.length === 2) {
            settings.prefix = args[1];
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ Prefix set to ${args[1]}`);
        }

        // ----- SPECIAL: withoutprefix -----
        if (first === 'withoutprefix' && args.length === 2) {
            const val = args[1].toLowerCase();
            if (!['on', 'off'].includes(val)) return reply("❌ Use on or off.");
            settings.commandWithoutPrefix = val === 'on';
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ Command without prefix is now ${val.toUpperCase()}`);
        }

        // ----- ARRAY MANAGEMENT (list, add, remove) -----
        const listCmds = ['list', 'add', 'remove'];
        if (listCmds.includes(first)) {
            const sub = first;
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
            let list = settings[key] || [];

            if (sub === 'list') {
                let text = `*${key.toUpperCase()}*\n\nTotal: ${list.length}\n\n`;
                list.forEach((item, i) => text += `${i+1}. ${item}\n`);
                return reply(text);
            }
            const item = args.slice(2).join(' ').trim();
            if (!item) return reply("❌ Provide item.");
            if (sub === 'add') {
                if (list.includes(item)) return reply("❌ Already exists.");
                list.push(item);
                settings[key] = list;
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ Added to ${key}: ${item}`);
            } else if (sub === 'remove') {
                const index = list.indexOf(item);
                if (index === -1) return reply("❌ Not found.");
                list.splice(index, 1);
                settings[key] = list;
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ Removed from ${key}: ${item}`);
            }
        }

        // ----- WHERE (SCOPE) -----
        if (first === 'where' && args.length >= 3) {
            const feature = args[1];
            const where = args[2].toLowerCase();
            const valid = ['all', 'group', 'private'];
            if (!valid.includes(where)) return reply("❌ Use: all, group, or private.");
            
            const scopeMap = {
                autoRead: 'autoReadScope',
                autoReact: 'autoReactScope',
                chatbot: 'chatbotScope',
                antiviewonce: 'antiviewonceScope',
                antidelete: 'antideleteScope'
            };
            const scopeKey = scopeMap[feature];
            if (!scopeKey) return reply(`❌ Feature '${feature}' cannot have a location.`);
            if (!(scopeKey in settings)) return reply(`❌ Feature '${feature}' not found.`);

            settings[scopeKey] = where;
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ ${feature} will now work in: ${where.toUpperCase()}`);
        }

        // ----- SET NUMERIC/STRING -----
        if (first === 'set' && args.length >= 3) {
            const feature = args[1];
            const value = args.slice(2).join(' ');
            if (!(feature in settings)) return reply(`❌ Feature '${feature}' not found.`);
            if (typeof settings[feature] === 'number') {
                const num = Number(value);
                if (isNaN(num)) return reply("❌ Must be a number.");
                settings[feature] = num;
            } else if (typeof settings[feature] === 'string') {
                settings[feature] = value;
            } else return reply("❌ Cannot set this feature.");
            await handler.saveGlobalSettings(settings);
            await handler.refreshConfig();
            return reply(`✅ ${feature} set to ${settings[feature]}`);
        }

        // ----- TOGGLE BOOLEAN (with optional scope) -----
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
            'autodeletemessages': 'autoDeleteMessages'
        };

        let feature = first;
        if (featureMap[feature]) feature = featureMap[feature];

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
                return reply(`✅ ${feature} is now ${action.toUpperCase()} (where: ${settings[scopeKey] || 'all'})`);
            } else {
                if (!possibleScopes.includes(scope)) {
                    return reply("❌ Scope must be 'all', 'group', or 'private'.");
                }
                settings[feature] = action === 'on';
                settings[scopeKey] = scope;
                await handler.saveGlobalSettings(settings);
                await handler.refreshConfig();
                return reply(`✅ ${feature} is now ${action.toUpperCase()} (where: ${scope})`);
            }
        } else {
            if (scope) {
                return reply(`❌ '${feature}' does not support location. Use just on/off.`);
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