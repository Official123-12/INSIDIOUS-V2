const axios = require('axios');

module.exports = {
    name: "anime",
    execute: async ({ conn, msg, args, from, fancy, reply }) => {
        if (!args[0]) return await reply(fancy("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ɴᴀᴍᴇ."));
        
        const query = args.join(' ');
        await reply(fancy(`🔍 ꜱᴇᴀʀᴄʜɪɴɢ: ${query}`));
        
        try {
            const search = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`);
            
            if (search.data.data.length > 0) {
                const anime = search.data.data[0];
                const txt = `
🎬 *${anime.title}*
📊 Score: ${anime.score || 'N/A'}
📅 Year: ${anime.year || 'N/A'}
📺 Episodes: ${anime.episodes || 'N/A'}
📝 Status: ${anime.status}
🔗 MyAnimeList: ${anime.url}

${anime.synopsis ? anime.synopsis.substring(0, 300) + '...' : 'No synopsis available.'}`;
                
                await reply(txt);
                
                if (anime.images.jpg.large_image_url) {
                    await conn.sendMessage(from, {
                        image: { url: anime.images.jpg.large_image_url },
                        caption: fancy("🖼️ ᴀɴɪᴍᴇ ᴄᴏᴠᴇʀ")
                    });
                }
            } else {
                await reply(fancy("❌ ɴᴏ ʀᴇꜱᴜʟᴛꜱ ꜰᴏᴜɴᴅ."));
            }
        } catch (e) {
            await reply(fancy("🥀 ᴀᴘɪ ᴇʀʀᴏʀ."));
        }
    }
};
