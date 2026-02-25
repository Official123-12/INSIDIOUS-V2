/**
 * 🚀 INSIDIOUS • GET BIO COMMAND
 * 📝 Get user status/about • Everyone
 * 🇬🇧 English Only • Premium Standard
 */

const { fancy } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "getbio",
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

            const status = await conn.fetchStatus(targetJid).catch(() => null);

            if (!status || !status.status) {
                return conn.sendMessage(from, { 
                    text: fancy(`╭━━━━━━━━━━━━━━━━━━╮\n   📝 USER BIO\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 ${userName}\n\n❌ User has no status/about set.`) 
                }, { quoted: msg, mentions: [targetJid] });
            }

            const bioBody = `╭━━━━━━━━━━━━━━━━━━╮\n   📝 USER BIO\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 User: @${targetJid.split('@')[0]}\n📝 Status: ${status.status}\n🕐 Updated: ${new Date(status.setAt).toLocaleString('en-US')}`;

            await conn.sendMessage(from, { text: fancy(bioBody), mentions: [targetJid] }, { quoted: msg });

        } catch (e) {
            console.error("❌ GetBio Error:", e);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to get user bio.`) }, { quoted: msg });
        }
    }
};

