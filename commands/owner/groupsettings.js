const handler = require('../../handler');

module.exports = {
    name: "groupsettings",
    aliases: ["gsettings", "groupconfig", "gset"],
    adminOnly: false,
    description: "Manage group‑specific settings (toggle features, view status)",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, isGroupAdmin, reply }) => {
        // Only work in groups
        if (!from.endsWith('@g.us')) 
            return reply("❌ This command only works in groups.");

        // Only group admins and owner can change settings
        if (!isOwner && !isGroupAdmin) 
            return reply("❌ Only group admins and bot owner can manage group settings.");

        const groupJid = from;

        // ========== AVAILABLE FEATURES ==========
        const features = [
            { name: 'antilink', desc: 'Block links' },
            { name: 'antiporn', desc: 'Block porn content' },
            { name: 'antiscam', desc: 'Block scam messages' },
            { name: 'antimedia', desc: 'Block specific media (photo, video, sticker)' },
            { name: 'antitag', desc: 'Prevent excessive tagging' },
            { name: 'sleepingmode', desc: 'Auto‑close group at night' },
            { name: 'antispam', desc: 'Prevent spamming' },
            { name: 'welcomeGoodbye', desc: 'Send welcome/goodbye messages' },
            { name: 'activemembers', desc: 'Auto‑remove inactive members' }
        ];

        // ========== NO ARGUMENTS – SHOW CURRENT SETTINGS ==========
        if (args.length === 0) {
            let text = `╭─── • 🥀 • ───╮\n   *GROUP SETTINGS*   \n╰─── • 🥀 • ───╯\n\n`;
            text += `Group: @${groupJid.split('@')[0]}\n`;
            text += `━━━━━━━━━━━━━━━━\n`;

            for (const feat of features) {
                const value = handler.getGroupSetting(groupJid, feat.name);
                const status = value ? '✅ *ON*' : '❌ *OFF*';
                text += `▸ *${feat.name}* : ${status}\n`;
                text += `  └ ${feat.desc}\n`;
            }

            text += `\n━━━━━━━━━━━━━━━━\n`;
            text += `*Usage:* \`.gsettings <feature> on/off\`\n`;
            text += `*Example:* \`.gsettings antilink on\``;

            return reply(fancy(text));
        }

        // ========== WITH ARGUMENTS – UPDATE SETTING ==========
        const feature = args[0].toLowerCase();
        const action = args[1]?.toLowerCase();

        // Validate feature
        const validFeatures = features.map(f => f.name);
        if (!validFeatures.includes(feature)) {
            return reply(`❌ Invalid feature. Available: ${validFeatures.join(', ')}`);
        }

        // Validate action
        if (!action || !['on', 'off'].includes(action)) {
            return reply("❌ Please specify `on` or `off`.\nExample: `.gsettings antilink on`");
        }

        // Apply change
        const newVal = action === 'on';
        try {
            await handler.setGroupSetting(groupJid, feature, newVal);
            reply(fancy(`✅ *Group setting updated*\n▸ ${feature} is now *${action.toUpperCase()}*`));
        } catch (error) {
            console.error('Error updating group setting:', error);
            reply('❌ Failed to update setting. Please try again later.');
        }
    }
};