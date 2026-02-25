/**
 * 🚀 INSIDIOUS • GET PP COMMAND
 * 🖼️ Get user profile picture • Everyone
 * 🇬🇧 English Only • Premium Standard
 */

const { fancy } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "getpp",
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

            let targetJid = sender;
            if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                targetJid = msg.message.extendedTextMessage.contextInfo.participant;
            }

            const ppUrl = await conn.profilePictureUrl(targetJid, 'image').catch(() => null);

            if (!ppUrl) {
                return conn.sendMessage(from, { 
                    text: fancy(`╭━━━━━━━━━━━━━━━━━━╮\n   🖼️ PROFILE PICTURE\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 ${userName}\n\n❌ User has no profile picture set.`) 
                }, { quoted: msg, mentions: [targetJid] });
            }

            await conn.sendMessage(from, { 
                image: { url: ppUrl }, 
                caption: fancy(`╭━━━━━━━━━━━━━━━━━━╮\n   🖼️ PROFILE PICTURE\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 User: @${targetJid.split('@')[0]}\n🕐 Time: ${new Date().toLocaleString('en-US')}\n\n_© ${config.developerName} Industries_`),
                mentions: [targetJid]
            }, { quoted: msg });

        } catch (e) {
            console.error("❌ GetPP Error:", e);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to get profile picture.`) }, { quoted: msg });
        }
    }
};

