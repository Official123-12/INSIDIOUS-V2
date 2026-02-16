const handler = require('../../handler');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "settings_array",
    ownerOnly: true,
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        const arrayType = args[0]; // scam, porn, blockmedia, emoji, country
        if (!arrayType) return reply("❌ Specify array type.");

        let settings = await handler.loadGlobalSettings();
        let list = [];
        let title = "";

        switch(arrayType) {
            case 'scam':
                list = settings.scamKeywords || [];
                title = "SCAM KEYWORDS";
                break;
            case 'porn':
                list = settings.pornKeywords || [];
                title = "PORN KEYWORDS";
                break;
            case 'blockmedia':
                list = settings.blockedMediaTypes || [];
                title = "BLOCKED MEDIA";
                break;
            case 'emoji':
                list = settings.autoReactEmojis || [];
                title = "AUTO-REACT EMOJIS";
                break;
            case 'country':
                list = settings.blockedCountries || [];
                title = "BLOCKED COUNTRIES";
                break;
            default:
                return reply("❌ Invalid array type.");
        }

        // Build a simple text menu with buttons to add/remove/list
        const prefix = settings.prefix || '.';
        const buttons = [
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "➕ Add",
                    id: `${prefix}add${arrayType}`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "➖ Remove",
                    id: `${prefix}remove${arrayType}`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "📋 List",
                    id: `${prefix}list${arrayType}`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🔙 Back",
                    id: `${prefix}settings`
                })
            }
        ];

        let listText = list.length ? list.map((v, i) => `${i+1}. ${v}`).join('\n') : "Empty";

        const card = {
            body: { text: fancy(
                `┏━━━━━━━━━━━━━━━━━━┓\n` +
                `┃   📋 ${title}  \n` +
                `┗━━━━━━━━━━━━━━━━━━┛\n\n` +
                `📊 Total: ${list.length}\n\n` +
                `${listText}\n\n` +
                `Select action:`
            ) },
            footer: { text: fancy(`⚙️ INSIDIOUS SETTINGS`) },
            header: { title: fancy(title) },
            nativeFlowMessage: { buttons }
        };

        const interactiveMessage = {
            body: { text: fancy(`📌 Array Management`) },
            footer: { text: fancy(`Use buttons to manage`) },
            header: { title: fancy(title) },
            carouselMessage: { cards: [card] }
        };

        const msgContent = { interactiveMessage };
        const waMsg = generateWAMessageFromContent(from, msgContent, {
            userJid: conn.user.id,
            upload: conn.waUploadToServer || conn.upload
        });
        await conn.relayMessage(from, waMsg.message, { messageId: waMsg.key.id });
    }
};