const handler = require('../../handler');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const { fancy } = require('../../lib/tools');

module.exports = {
    name: "settings",
    aliases: ["setting", "config"],
    ownerOnly: true,
    description: "Manage all bot settings with interactive carousel",
    
    execute: async (conn, msg, args, { from, sender, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        try {
            const settings = await handler.loadGlobalSettings();
            const prefix = settings.prefix || '.';
            let userName = sender.split('@')[0];

            // Prepare media (optional)
            let imageMedia = null;
            if (settings.settingsImage || settings.menuImage) {
                try {
                    const imgSrc = (settings.settingsImage || settings.menuImage).startsWith('http') 
                        ? { url: settings.settingsImage || settings.menuImage } 
                        : { url: settings.settingsImage || settings.menuImage };
                    imageMedia = await prepareWAMessageMedia(
                        { image: imgSrc },
                        { upload: conn.waUploadToServer || conn.upload }
                    );
                } catch (e) { console.error("Settings image error:", e); }
            }

            // ==================== BUILD CARDS ====================
            const cards = [];

            // --- CARD 1: ANTI FEATURES ---
            cards.push(buildCard({
                title: "ANTI FEATURES",
                image: imageMedia,
                userName,
                items: [
                    { label: "Anti Link", key: "antilink", value: settings.antilink },
                    { label: "Anti Porn", key: "antiporn", value: settings.antiporn },
                    { label: "Anti Scam", key: "antiscam", value: settings.antiscam },
                    { label: "Anti Media", key: "antimedia", value: settings.antimedia },
                    { label: "Anti Tag", key: "antitag", value: settings.antitag },
                    { label: "Anti ViewOnce", key: "antiviewonce", value: settings.antiviewonce },
                    { label: "Anti Delete", key: "antidelete", value: settings.antidelete },
                    { label: "Sleeping Mode", key: "sleepingmode", value: settings.sleepingmode },
                    { label: "Anti Bugs", key: "antibugs", value: settings.antibugs },
                    { label: "Anti Spam", key: "antispam", value: settings.antispam },
                    { label: "Anti Call", key: "anticall", value: settings.anticall }
                ],
                prefix,
                category: "anti"
            }));

            // --- CARD 2: AUTO FEATURES ---
            cards.push(buildCard({
                title: "AUTO FEATURES",
                image: imageMedia,
                userName,
                items: [
                    { label: "Auto Read", key: "autoRead", value: settings.autoRead, scope: settings.autoReadScope },
                    { label: "Auto React", key: "autoReact", value: settings.autoReact, scope: settings.autoReactScope },
                    { label: "Auto Typing", key: "autoTyping", value: settings.autoTyping },
                    { label: "Auto Recording", key: "autoRecording", value: settings.autoRecording },
                    { label: "Auto Bio", key: "autoBio", value: settings.autoBio },
                    { label: "Auto Status", key: "autostatus", value: settings.autostatus },
                    { label: "Download Status", key: "downloadStatus", value: settings.downloadStatus }
                ],
                prefix,
                category: "auto"
            }));

            // --- CARD 3: GROUP MANAGEMENT ---
            cards.push(buildCard({
                title: "GROUP MGMT",
                image: imageMedia,
                userName,
                items: [
                    { label: "Welcome/Goodbye", key: "welcomeGoodbye", value: settings.welcomeGoodbye },
                    { label: "Active Members", key: "activemembers", value: settings.activemembers },
                    { label: "Auto Block Country", key: "autoblockCountry", value: settings.autoblockCountry }
                ],
                prefix,
                category: "group"
            }));

            // --- CARD 4: AI FEATURES ---
            cards.push(buildCard({
                title: "AI FEATURES",
                image: imageMedia,
                userName,
                items: [
                    { label: "Chatbot", key: "chatbot", value: settings.chatbot }
                ],
                prefix,
                category: "ai"
            }));

            // --- CARD 5: LIMITS ---
            cards.push(buildCard({
                title: "LIMITS",
                image: imageMedia,
                userName,
                items: [
                    { label: "Warn Limit", key: "warnLimit", value: settings.warnLimit, type: "number" },
                    { label: "Max Tags", key: "maxTags", value: settings.maxTags, type: "number" },
                    { label: "Inactive Days", key: "inactiveDays", value: settings.inactiveDays, type: "number" },
                    { label: "AntiSpam Limit", key: "antiSpamLimit", value: settings.antiSpamLimit, type: "number" },
                    { label: "AntiSpam Interval", key: "antiSpamInterval", value: settings.antiSpamInterval + "ms", type: "number" },
                    { label: "Sleep Start", key: "sleepingStart", value: settings.sleepingStart, type: "time" },
                    { label: "Sleep End", key: "sleepingEnd", value: settings.sleepingEnd, type: "time" },
                    { label: "Status Reply Limit", key: "autoStatusLimit", value: settings.autoStatusLimit, type: "number" }
                ],
                prefix,
                category: "limits"
            }));

            // --- CARD 6: MODE & PREFIX ---
            cards.push(buildCard({
                title: "MODE & PREFIX",
                image: imageMedia,
                userName,
                items: [
                    { label: "Mode", key: "mode", value: settings.mode, type: "mode" },
                    { label: "Prefix", key: "prefix", value: settings.prefix, type: "prefix" },
                    { label: "Max Co-Owners", key: "maxCoOwners", value: settings.maxCoOwners, type: "number" },
                    { label: "Always Online", key: "alwaysOnline", value: settings.alwaysOnline }
                ],
                prefix,
                category: "mode"
            }));

            // --- CARD 7: SCOPE SETTINGS ---
            cards.push(buildCard({
                title: "SCOPES",
                image: imageMedia,
                userName,
                items: [
                    { label: "Auto Read Scope", key: "autoReadScope", value: settings.autoReadScope, type: "scope" },
                    { label: "Auto React Scope", key: "autoReactScope", value: settings.autoReactScope, type: "scope" }
                ],
                prefix,
                category: "scope"
            }));

            // --- CARD 8: ARRAY SETTINGS ---
            cards.push(buildCard({
                title: "ARRAY SETTINGS",
                image: imageMedia,
                userName,
                items: [
                    { label: "Scam Keywords", key: "scam", count: settings.scamKeywords?.length || 0 },
                    { label: "Porn Keywords", key: "porn", count: settings.pornKeywords?.length || 0 },
                    { label: "Blocked Media", key: "blockmedia", count: settings.blockedMediaTypes?.length || 0 },
                    { label: "React Emojis", key: "emoji", count: settings.autoReactEmojis?.length || 0 },
                    { label: "Blocked Countries", key: "country", count: settings.blockedCountries?.length || 0 }
                ],
                prefix,
                category: "arrays"
            }));

            // ==================== SEND CAROUSEL ====================
            const interactiveMsg = {
                body: { text: fancy(
                    `╭─── • 🥀 • ───╮\n` +
                    `   ⚙️ BOT SETTINGS   \n` +
                    `╰─── • 🥀 • ───╯\n\n` +
                    `👤 Owner: ${userName}\n` +
                    `📊 Total cards: ${cards.length}\n` +
                    `◀️ Swipe left/right for categories ▶️`
                ) },
                footer: { text: fancy(settings.footer) },
                header: { title: fancy(`⚙️ CONFIGURATION`) },
                carouselMessage: { cards }
            };

            const msgContent = { interactiveMessage: interactiveMsg };
            const waMsg = generateWAMessageFromContent(from, msgContent, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer || conn.upload
            });
            await conn.relayMessage(from, waMsg.message, { messageId: waMsg.key.id });

        } catch (e) {
            console.error("Settings carousel error:", e);
            reply("Error loading settings carousel. Check console.");
        }
    }
};

// Helper to build a card
function buildCard({ title, image, userName, items, prefix, category }) {
    const buttons = [];

    items.forEach(item => {
        if (item.type === 'number' || item.type === 'time' || item.type === 'mode' || item.type === 'prefix' || item.type === 'scope') {
            // For numeric/time/scope settings, provide a button to adjust
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `⚙️ ${item.label}`,
                    id: `${prefix}set_${category} ${item.key}`
                })
            });
        } else if (item.count !== undefined) {
            // Array settings – button to manage
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `📋 ${item.label} (${item.count})`,
                    id: `${prefix}manage_${item.key}`
                })
            });
        } else {
            // Boolean toggle
            const status = item.value ? '✅' : '❌';
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `${status} ${item.label}`,
                    id: `${prefix}toggle ${item.key}`
                })
            });
        }
    });

    const cardHeader = image ? { imageMessage: image.imageMessage } : { title: fancy(title) };

    return {
        body: { text: fancy(
            `╭─── • 🥀 • ───╮\n` +
            `   ${title}  \n` +
            `╰─── • 🥀 • ───╯\n\n` +
            `👋 Hello, *${userName}*\n` +
            `Tap buttons to adjust.`
        ) },
        footer: { text: fancy(`⚙️ INSIDIOUS SETTINGS`) },
        header: cardHeader,
        nativeFlowMessage: { buttons }
    };
}