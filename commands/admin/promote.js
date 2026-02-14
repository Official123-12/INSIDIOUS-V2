// commands/group/promote.js
module.exports = {
    name: "promote",
    description: "Promote a member to admin",
    usage: "@mention or reply to their message",
    execute: async (conn, msg, args, { from, isOwner, reply, config, fancy, isGroup, sender, isParticipantAdmin, isBotAdmin }) => {
        if (!isGroup) return reply("❌ This command can only be used in groups.");

        const isAdmin = await isParticipantAdmin(conn, from, sender);
        if (!isAdmin && !isOwner) return reply("❌ Only group admins can use this command.");

        const botAdmin = await isBotAdmin(conn, from);
        if (!botAdmin) return reply("❌ I need to be an admin to promote members.");

        let target = null;
        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        } else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
            target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else {
            return reply("❌ Please mention the user or reply to their message.");
        }

        try {
            await conn.groupParticipantsUpdate(from, [target], "promote");
            
            const text = fancy(
                `┏━━━━━━━━━━━━━━┓\n` +
                `┃   ⭐ MEMBER PROMOTED   ┃\n` +
                `┗━━━━━━━━━━━━━━┛\n\n` +
                `👤 *User:* @${target.split('@')[0]}\n` +
                `👥 *Action by:* @${sender.split('@')[0]}\n\n` +
                `_They are now an admin._`
            );

            await conn.sendMessage(from, {
                text: text,
                mentions: [target, sender],
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                        newsletterName: config.botName || 'INSIDIOUS'
                    }
                }
            });
        } catch (e) {
            reply(`❌ Failed to promote: ${e.message}`);
        }
    }
};