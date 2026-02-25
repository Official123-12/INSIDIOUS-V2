/**
 * 🚀 INSIDIOUS • LEAVE COMMAND
 * 🚪 Leave current group • Owner only
 * 🇬🇧 English Only • Premium Standard
 */

const { fancy } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "leave",
    category: "admin",
    execute: async (conn, msg, args, { from, sender, pushname, isOwner }) => {
        try {
            if (!isOwner) {
                return conn.sendMessage(from, { text: fancy(`❌ Access Denied!\n\n🔒 This command is for bot owner only.`) }, { quoted: msg });
            }

            if (!from.endsWith('@g.us')) {
                return conn.sendMessage(from, { text: fancy(`❌ This command only works in groups!`) }, { quoted: msg });
            }

            const userNumber = sender.split('@')[0];
            let userName = pushname?.trim() || '';
            if (!userName || userName === 'undefined') {
                try {
                    const contact = conn.contactStore?.contacts?.[sender] || await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || userName;
                } catch {}
            }
            userName = userName?.trim() || `User_${userNumber.slice(-4)}`;

            const leaveBody = `╭━━━━━━━━━━━━━━━━━━╮\n   👋 GOODBYE!\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 Admin: ${userName}\n🚪 Bot is leaving this group...\n\n_© ${config.developerName} Industries_`;

            await conn.sendMessage(from, { text: fancy(leaveBody), mentions: [sender] }, { quoted: msg });
            await conn.groupLeave(from);

        } catch (e) {
            console.error("❌ Leave Error:", e);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to leave group.`) }, { quoted: msg });
        }
    }
};

