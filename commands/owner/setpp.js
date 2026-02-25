/**
 * 🚀 INSIDIOUS • SET PP COMMAND
 * 🖼️ Change bot profile picture • Owner only
 * 🇬🇧 English Only • Premium Standard
 */

const { fancy } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "setpp",
    category: "admin",
    execute: async (conn, msg, args, { from, sender, pushname, isOwner }) => {
        try {
            if (!isOwner) {
                return conn.sendMessage(from, { text: fancy(`❌ Access Denied!\n\n🔒 This command is for bot owner only.`) }, { quoted: msg });
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

            if (!msg.message?.imageMessage) {
                return conn.sendMessage(from, { 
                    text: fancy(`╭━━━━━━━━━━━━━━━━━━╮\n   🖼️ SET PROFILE PIC\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 ${userName}\n\n❌ Please send/reply to an image to set as profile picture.\n\n💡 Usage: Send image → ${config.prefix}setpp`) 
                }, { quoted: msg });
            }

            const media = await conn.downloadMediaMessage(msg.message.imageMessage);
            await conn.updateProfilePicture(conn.user.id, media);

            const setppBody = `╭━━━━━━━━━━━━━━━━━━╮\n   ✅ PP UPDATED\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 Admin: ${userName}\n🖼️ New profile picture set!\n🕐 Time: ${new Date().toLocaleString('en-US')}`;

            await conn.sendMessage(from, { text: fancy(setppBody), mentions: [sender] }, { quoted: msg });

        } catch (e) {
            console.error("❌ SetPP Error:", e);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to update profile picture.`) }, { quoted: msg });
        }
    }
};

