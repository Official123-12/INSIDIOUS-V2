const handler = require('../../handler');
const fs = require('fs-extra');
const path = require('path');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "settings",
    aliases: ["setting", "config", "settingan"],
    ownerOnly: true,
    description: "Manage all bot settings with interactive carousel",
    usage: "",

    execute: async (conn, msg, args, { from, sender, fancy, config, isOwner, pushname, reply }) => {
        if (!isOwner) return reply("❌ This command is for owner only!");

        try {
            // Jina la mtumiaji
            let userName = pushname || sender.split('@')[0];

            // Load current settings
            let settings = await handler.loadGlobalSettings();
            const prefix = settings.prefix || '.';

            // Prepare media
            let imageMedia = null;
            const settingsImage = config.settingsImage || config.botImage || 'https://files.catbox.moe/mfngio.png';
            try {
                const imgSrc = settingsImage.startsWith('http') ? { url: settingsImage } : { url: settingsImage };
                imageMedia = await prepareWAMessageMedia(
                    { image: imgSrc },
                    { upload: conn.waUploadToServer || conn.upload }
                );
            } catch (e) { console.error("Image error:", e); }

            let audioMedia = null;
            const settingsAudio = config.settingsAudio || config.menuAudio;
            if (settingsAudio) {
                try {
                    const audioSrc = settingsAudio.startsWith('http') ? { url: settingsAudio } : { url: settingsAudio };
                    audioMedia = await prepareWAMessageMedia(
                        { audio: audioSrc, mimetype: 'audio/mpeg' },
                        { upload: conn.waUploadToServer || conn.upload }
                    );
                } catch (e) { console.error("Audio error:", e); }
            }

            // ==================== BUILD CARDS ====================
            const cards = [];

            // --- CARD 1: ANTI / SECURITY ---
            cards.push(buildCard({
                title: "🛡️ ANTI FEATURES",
                image: imageMedia,
                audio: audioMedia,
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
                title: "⚡ AUTO FEATURES",
                image: imageMedia,
                audio: audioMedia,
                userName,
                items: [
                    { label: "Auto Read", key: "autoRead", value: settings.autoRead },
                    { label: "Auto React", key: "autoReact", value: settings.autoReact },
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
                title: "👥 GROUP MGMT",
                image: imageMedia,
                audio: audioMedia,
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
                title: "🤖 AI FEATURES",
                image: imageMedia,
                audio: audioMedia,
                userName,
                items: [
                    { label: "Chatbot", key: "chatbot", value: settings.chatbot }
                ],
                prefix,
                category: "ai"
            }));

            // --- CARD 5: THRESHOLDS & LIMITS ---
            cards.push(buildCard({
                title: "⚙️ LIMITS",
                image: imageMedia,
                audio: audioMedia,
                userName,
                items: [
                    { label: "Warn Limit", key: "warnLimit", value: settings.warnLimit, type: "number" },
                    { label: "Max Tags", key: "maxTags", value: settings.maxTags, type: "number" },
                    { label: "Inactive Days", key: "inactiveDays", value: settings.inactiveDays, type: "number" },
                    { label: "AntiSpam Limit", key: "antiSpamLimit", value: settings.antiSpamLimit, type: "number" },
                    { label: "AntiSpam Interval", key: "antiSpamInterval", value: settings.antiSpamInterval + "ms", type: "number" },
                    { label: "Sleep Start", key: "sleepingStart", value: settings.sleepingStart, type: "time" },
                    { label: "Sleep End", key: "sleepingEnd", value: settings.sleepingEnd, type: "time" }
                ],
                prefix,
                category: "limits"
            }));

            // --- CARD 6: PAIRING & MODE ---
            cards.push(buildCard({
                title: "🔐 MODE & PREFIX",
                image: imageMedia,
                audio: audioMedia,
                userName,
                items: [
                    { label: "Mode", key: "mode", value: settings.mode, type: "mode" },
                    { label: "Prefix", key: "prefix", value: settings.prefix, type: "prefix" },
                    { label: "Max Co-Owners", key: "maxCoOwners", value: settings.maxCoOwners, type: "number" }
                ],
                prefix,
                category: "mode"
            }));

            // --- CARD 7: ARRAY SETTINGS (Quick access) ---
            cards.push(buildCard({
                title: "📋 ARRAY SETTINGS",
                image: imageMedia,
                audio: audioMedia,
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
            const interactiveMessage = {
                body: { text: fancy(
                    `╔════════════════════╗\n` +
                    `║   ⚙️ BOT SETTINGS   ║\n` +
                    `╚════════════════════╝\n\n` +
                    `👤 Owner: ${userName}\n` +
                    `📊 Total cards: ${cards.length}\n` +
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `◀️ Swipe left/right for categories ▶️`
                ) },
                footer: { text: fancy(`✨ INSIDIOUS v2.1.1 | Tap buttons to toggle`) },
                header: { title: fancy(`⚙️ CONFIGURATION`) },
                carouselMessage: { cards }
            };

            const msgContent = { interactiveMessage };
            const waMsg = generateWAMessageFromContent(from, msgContent, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer || conn.upload
            });
            await conn.relayMessage(from, waMsg.message, { messageId: waMsg.key.id });

        } catch (e) {
            console.error("Settings carousel error:", e);
            // Fallback to old text settings
            const settings = await handler.loadGlobalSettings();
            let text = `╭─── • 🥀 • ───╮\n   *GLOBAL SETTINGS*  \n╰─── • 🥀 • ───╯\n\n`;
            // ... (same as before, but simplified)
            reply(fancy(text));
        }
    }
};

// Helper function to build a card
function buildCard({ title, image, audio, userName, items, prefix, category }) {
    const buttons = [];

    items.forEach(item => {
        if (item.type === 'number' || item.type === 'time' || item.type === 'mode' || item.type === 'prefix') {
            // For numeric/time settings, provide buttons to adjust
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `⚙️ ${item.label}`,
                    id: `${prefix}settings_${category} ${item.key}`
                })
            });
        } else if (item.count !== undefined) {
            // Array settings – button to open management menu
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `📋 ${item.label} (${item.count})`,
                    id: `${prefix}settings_array ${item.key}`
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

    // Header
    const cardHeader = {};
    if (audio) cardHeader.audioMessage = audio.audioMessage;
    else if (image) cardHeader.imageMessage = image.imageMessage;
    else cardHeader.title = fancy(title);

    return {
        body: { text: fancy(
            `┏━━━━━━━━━━━━━━━━━━┓\n` +
            `┃   ${title}  \n` +
            `┗━━━━━━━━━━━━━━━━━━┛\n\n` +
            `👋 Hello, *${userName}*!\n` +
            `Tap buttons below to adjust.`
        ) },
        footer: { text: fancy(`⚙️ INSIDIOUS SETTINGS`) },
        header: cardHeader,
        nativeFlowMessage: { buttons }
    };
}