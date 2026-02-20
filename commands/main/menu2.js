/**
 * 🥀 WRONG TURN 6 - SUPREME HUB
 * 🥀 THEME: LUXURY VERTICAL (NO TICKS)
 * 🥀 LOGO FIX: BUFFERED THUMBNAIL (LARGE)
 */

const { doc, getDoc } = require('firebase/firestore');
const axios = require('axios');

module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const pushName = m.pushName || "ꜱᴜʙꜱᴄʀɪʙᴇʀ";

        // 1. FETCH CONFIG KUTOKA FIREBASE
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const config = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public" };
        
        const uptimeSeconds = process.uptime();
        const uptimeStr = `${Math.floor(uptimeSeconds / 3600)}ʜ ${Math.floor((uptimeSeconds % 3600) / 60)}ᴍ`;

        // 2. CATEGORIZE COMMANDS
        const categories = {};
        commands.forEach(cmd => {
            const cat = cmd.category ? cmd.category.toUpperCase() : 'ɢᴇɴᴇʀᴀʟ';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        // 3. BUILD LUXURY MENU BODY
        let menuBody = `╭─── • 🥀 • ───╮\n`;
        menuBody += `  ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  ʙ ᴏ ᴛ \n`;
        menuBody += `╰─── • 🥀 • ───╯\n\n`;

        menuBody += `┌  🥀  *ꜱʏꜱᴛᴇᴍ  ɪɴꜰᴏ*\n`;
        menuBody += `│  ᴜꜱᴇʀ: ${pushName}\n`;
        menuBody += `│  ᴍᴏᴅᴇ: ${config.mode?.toUpperCase() || 'PUBLIC'}\n`;
        menuBody += `│  ᴘʀᴇꜰɪx: [ ${config.prefix || '.'} ]\n`;
        menuBody += `│  ᴛᴏᴛᴀʟ: ${commands.length} ᴄᴍᴅꜱ\n`;
        menuBody += `│  ᴜᴘᴛɪᴍᴇ: ${uptimeStr}\n`;
        menuBody += `│  ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\n`;
        menuBody += `└──────────────\n\n`;

        const sortedCats = Object.keys(categories).sort();
        for (const cat of sortedCats) {
            menuBody += `╭──• *${cat}* •\n`;
            categories[cat].sort().forEach(name => {
                menuBody += `│ ◦ ${config.prefix || '.'}${name}\n`;
            });
            menuBody += `╰──────────────\n\n`;
        }

        menuBody += `_© 𝟮𝟬𝟮𝟲 ꜱᴛᴀɴʏᴛᴢ ɪɴᴅᴜꜱᴛʀɪᴇs_`;

        try {
            // 4. LOGO FIX: TUNAVUTA PICHA KUWA BUFFER ILI ILI LAZIMISHE KUONESHWA
            const response = await axios.get('https://files.catbox.moe/59ays3.jpg', { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');

            // 5. SENDING THE MESSAGE WITH THE LARGE LOGO
            await sock.sendMessage(from, { 
                text: menuBody, 
                contextInfo: {
                    ...forwardedContext, // Inabeba newsletter masking
                    externalAdReply: {
                        title: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 : ᴍᴀɪɴꜰʀᴀᴍᴇ",
                        body: "ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ",
                        mediaType: 1, 
                        renderLargerThumbnail: true, // HII NDIO INAFANYA LOGO IWE KUBWA
                        thumbnail: buffer, // TUNATUMIA BUFFER BADALA YA URL
                        sourceUrl: "https://whatsapp.com/channel/stanytz",
                        showAdAttribution: true 
                    }
                }
            }, { quoted: m });

        } catch (e) {
            // Fallback ikiwa internet ya server inasumbua kuvuta picha
            await sock.sendMessage(from, { 
                text: menuBody, 
                contextInfo: forwardedContext 
            }, { quoted: m });
        }
    }
};
