module.exports = {
    name: "tagall",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let metadata = await conn.groupMetadata(from);
        let participants = metadata.participants;
        let mentions = participants.map(p => p.id);
        let txt = `╭── • 🥀 • ──╮\n  ${fancy("ɪɴꜱɪᴅɪᴏᴜꜱ ᴀʟᴇʀᴛ")}\n╰── • 🥀 • ──╯\n\n${args.join(' ') || 'Attention everyone!'}\n\n`;
        for (let mem of participants) {
            txt += ` @${mem.id.split('@')[0]}\n`;
        }
        conn.sendMessage(from, { text: txt, mentions: mentions });
    }
};
