const handler = require('../../handler');

module.exports = {
    name: "groupsettings",
    aliases: ["gsettings", "groupconfig"],
    adminOnly: false,
    description: "Manage settings for this specific group",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, isGroupAdmin, reply }) => {
        if (!from.endsWith('@g.us')) return reply("❌ This command only works in groups.");
        if (!isOwner && !isGroupAdmin) return reply("❌ Only group admins and bot owner can manage group settings.");

        const groupJid = from;
        const settings = await handler.loadGlobalSettings();

        if (args.length === 0) {
            const features = [
                'antilink', 'antiporn', 'antiscam', 'antimedia', 'antitag',
                'sleepingmode', 'antispam', 'welcomeGoodbye', 'activemembers'
            ];
            let text = `╭─── • 🥀 • ───╮\n   *GROUP SETTINGS*   \n╰─── • 🥀 • ───╯\n\n`;
            for (const feat of features) {
                const value = handler.getGroupSetting(groupJid, feat);
                text += `▸ ${feat} : ${value ? '✅' : '❌'}\n`;
            }
            text += `\nUse: .gsettings <feature> on/off`;
            return reply(fancy(text));
        }

        const feature = args[0].toLowerCase();
        const action = args[1]?.toLowerCase();

        const validFeatures = [
            'antilink', 'antiporn', 'antiscam', 'antimedia', 'antitag',
            'sleepingmode', 'antispam', 'welcomeGoodbye', 'activemembers'
        ];
        if (!validFeatures.includes(feature)) return reply(`❌ Invalid feature. Valid: ${validFeatures.join(', ')}`);
        if (!action || !['on', 'off'].includes(action)) return reply("❌ Specify on or off.");

        const newVal = action === 'on';
        await handler.setGroupSetting(groupJid, feature, newVal);
        reply(fancy(`✅ Group setting updated: ${feature} = ${action.toUpperCase()}`));
    }
};