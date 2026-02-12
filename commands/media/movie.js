const axios = require('axios');
module.exports = {
    name: "movie",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴇɴᴛᴇʀ ᴍᴏᴠɪᴇ ɴᴀᴍᴇ!"));
        try {
            const res = await axios.get(`https://ef-prime-md-ultra-apis.vercel.app/search/moviesearch?q=${encodeURIComponent(args.join(' '))}`); // Scraper API
            const m = res.data[0];
            let txt = `╭── • 🥀 • ──╮\n  ${fancy("ᴍᴏᴠɪᴇ ꜰᴏᴜɴᴅ")}\n╰── • 🥀 • ──╯\n\n` +
                `🎬 *ᴛɪᴛʟᴇ:* ${m.title}\n` +
                `📅 *ʏᴇᴀʀ:* ${m.year}\n` +
                `⭐ *ʀᴀᴛɪɴɢ:* ${m.rating}\n\n` +
                `📥 *ᴅᴏᴡɴʟᴏᴀᴅ ʟɪɴᴋ:* ${m.download_url}\n\n` +
                `${fancy("ᴇɴᴊᴏʏ ᴛʜᴇ ʜᴏʀʀᴏʀ.")}`;
            await conn.sendMessage(from, { image: { url: m.poster }, caption: txt });
        } catch (e) { msg.reply("🥀 ᴍᴏᴠɪᴇ ɴᴏᴛ ꜰᴏᴜɴᴅ ɪɴ ᴛʜᴇ ꜰᴜʀᴛʜᴇʀ."); }
    }
};
