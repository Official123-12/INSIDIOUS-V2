/**
 * 🚀 INSIDIOUS • INSPECT COMMAND
 * 🔍 Get group info from invite link • Everyone
 * 🇬🇧 English Only • Premium Standard
 */

const { fancy } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "inspect",
    category: "utility",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            const userNumber = sender.split('@')[0];
            let userName = pushname?.trim() || '';
            if (!userName || userName === 'undefined') {
                try {
                    const contact = conn.contactStore?.contacts?.[sender] || await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || userName;
                } catch {}
            }
            userName = userName?.trim() || `User_${userNumber.slice(-4)}`;

            const inviteLink = args[0];
            if (!inviteLink || !inviteLink.includes('chat.whatsapp.com/')) {
                return conn.sendMessage(from, { 
                    text: fancy(`╭━━━━━━━━━━━━━━━━━━╮\n   🔍 INSPECT LINK\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 ${userName}\n\n❌ Please provide a valid WhatsApp group invite link.\n\n💡 Usage: ${config.prefix}inspect <invite_link>\n\n📌 Example:\n${config.prefix}inspect https://chat.whatsapp.com/ABC123`) 
                }, { quoted: msg });
            }

            const code = inviteLink.split('chat.whatsapp.com/')[1];
            const groupInfo = await conn.groupGetInviteInfo(code);

            const inspectBody = `╭━━━━━━━━━━━━━━━━━━╮\n   🔍 GROUP INFO\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 Requested by: ${userName}\n\n┌─── 📋 GROUP DETAILS ───\n│ 🏷️ Name: ${groupInfo.subject}\n│ 👥 Members: ${groupInfo.size}\n│ 📅 Created: ${new Date(groupInfo.creation * 1000).toLocaleDateString('en-US')}\n│ 👑 Owner: @${groupInfo.owner?.split('@')[0] || 'Unknown'}\n│ 📝 Description: ${groupInfo.desc?.slice(0, 100) || 'No description'}\n└─────────────────────`;

            await conn.sendMessage(from, { text: fancy(inspectBody), mentions: [sender, groupInfo.owner].filter(Boolean) }, { quoted: msg });

        } catch (e) {
            console.error("❌ Inspect Error:", e);
            await conn.sendMessage(from, { text: fancy(`❌ Invalid invite link or group not found.`) }, { quoted: msg });
        }
    }
};

