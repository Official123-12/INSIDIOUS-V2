const fs = require('fs-extra');
const path = require('path');
const { prepareWAMessageMedia, generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');

module.exports = {
    name: "menu",
    execute: async (conn, msg, args, { from, pushname }) => {
        try {
            await conn.sendPresenceUpdate('composing', from);

            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath);
            
            let cards = [];

            // 🚀 LOOP KUPITIA KILA CATEGORY KUTENGENEZA KADI (MAPAZIA)
            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                if (!(fs.statSync(catPath).isDirectory())) continue;

                const files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace('.js', ''));

                if (files.length > 0) {
                    // Kutengeneza Buttons za wima kwa kila command
                    let buttons = files.map(file => ({
                        "name": "quick_reply",
                        "buttonParamsJson": JSON.stringify({
                            "display_text": `${config.prefix}${file}`,
                            "id": `${config.prefix}${file}`
                        })
                    }));

                    // Kutengeneza Kadi ya hii Category
                    cards.push({
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: `🥀 *${fancy(cat.toUpperCase())} ᴄᴀᴛᴇɢᴏʀʏ*\n\nʜᴇʟʟᴏ ${pushname},\nꜱᴇʟᴇᴄᴛ ᴀ ꜱᴘᴇᴄɪꜰɪᴄ ᴄᴏᴍᴍᴀɴᴅ ʙᴇʟᴏᴡ.\n\n👑 ᴅᴇᴠ: ${config.developerName}`
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: fancy(config.footer)
                        }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: fancy(config.botName),
                            hasMediaAttachment: true,
                            imageMessage: await prepareWAMessageMedia({ image: { url: config.menuImage } }, { upload: conn.waUploadToServer })
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: buttons
                        })
                    });
                }
            }

            // 🚀 TAYARISHA CAROUSEL MESSAGE
            const msgContent = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            body: proto.Message.InteractiveMessage.Body.fromObject({
                                text: fancy(`👹 ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1 ᴅᴀꜱʜʙᴏᴀʀᴅ\nᴜᴘᴛɪᴍᴇ: ${runtime(process.uptime())}\n\nꜱʟɪᴅᴇ ᴛᴏ ᴛʜᴇ ʟᴇꜰᴛ ᴏʀ ʀɪɢʜᴛ ᴛᴏ ᴇxᴘʟᴏʀᴇ ᴄᴀᴛᴇɢᴏʀɪᴇꜱ.`)
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                text: fancy("ꜱᴛᴀɴʏᴛᴢ ᴀᴜᴛᴏᴍᴀᴛɪᴏɴ ꜱʏꜱᴛᴇᴍ")
                            }),
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                hasMediaAttachment: false
                            }),
                            carouselMessage: proto.Message.CarouselMessage.fromObject({
                                cards: cards
                            }),
                            contextInfo: {
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: config.newsletterJid,
                                    newsletterName: config.botName,
                                    serverMessageId: 100
                                }
                            }
                        })
                    }
                }
            }, { quoted: msg });

            await conn.relayMessage(from, msgContent.message, { messageId: msgContent.key.id });

        } catch (e) {
            console.error(e);
            // Fallback kama simu haisupport Carousel
            msg.reply("🥀 Carousel menu failed. Please ensure you are using the latest WhatsApp version.");
        }
    }
};