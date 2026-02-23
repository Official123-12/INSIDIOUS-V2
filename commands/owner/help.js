module.exports = {
    name: "help",
    aliases: ["h", "menu", "aid", "msaada"],
    ownerOnly: false,
    description: "Show bot help in your preferred language",
    
    execute: async (conn, msg, args, { from, fancy, reply, config }) => {
        // ==================== LANGUAGE DATABASE ====================
        const languages = {
            // Full translations
            en: {
                name: "English",
                help: `
╭─── • 🥀 • ───╮
   *INSIDIOUS BOT HELP*
╰─── • 🥀 • ───╯

*GENERAL COMMANDS*
▸ .help [language] - Show this help in your language
▸ .ping - Check bot response time
▸ .alive - Check bot status
▸ .mode - View current bot mode
▸ .settings - Manage global bot settings (owner only)
▸ .groupsettings - Manage group-specific settings (admins)

*ANTI-FEATURES* (can be toggled per group)
▸ antilink - Delete messages containing links
▸ antiporn - Block adult content
▸ antiscam - Detect and delete scam messages
▸ antimedia - Block specific media types (photo, video, sticker)
▸ antitag - Prevent excessive tagging
▸ sleepingmode - Auto-close group at night
▸ antispam - Limit message frequency
▸ anticall - Reject calls and block spammers
▸ antistatusmention - Warn/block users who mention the bot in status

*AUTO FEATURES* (global or per group)
▸ autoRead - Auto-read messages (scope: all/group/private)
▸ autoReact - Auto-react with random emoji (scope)
▸ autoTyping - Show typing indicator
▸ autoRecording - Show recording indicator (private chats)
▸ autoBio - Update bot bio with uptime
▸ autostatus - Auto-view/react/reply to statuses
▸ downloadStatus - Download status media (owner only)
▸ autoSaveContact - Save new contacts automatically
▸ autoDeleteMessages - Auto-delete forwarded messages after expiry

*GROUP MANAGEMENT*
▸ welcomeGoodbye - Send welcome/goodbye messages
▸ activemembers - Auto-remove inactive members
▸ autoblockCountry - Block users from specific countries

*CHATBOT*
▸ chatbot - Enable AI replies (scope)

*SETTINGS*
Use .settings to configure globally.
Use .groupsettings to configure per group.

For numeric settings:
▸ warnLimit - Max warnings before removal
▸ maxTags - Max mentions allowed in one message
▸ inactiveDays - Days of inactivity before removal
▸ antiSpamLimit - Messages per interval
▸ antiSpamInterval - Interval in ms
▸ sleepingStart/End - Time for sleeping mode
▸ maxCoOwners - Max number of co-owners
▸ statusReplyLimit - Daily status reply limit
▸ autoExpireMinutes - Minutes before auto-delete

*LISTS* (can be managed with .settings)
▸ scamKeywords - Words that trigger antiscam
▸ pornKeywords - Words that trigger antiporn
▸ blockedMediaTypes - Media types to block
▸ autoReactEmojis - Emojis for auto-react
▸ blockedCountries - Country codes to block

*HOW TO USE*
- Toggle features: .settings <feature> on/off
- Set scope: .settings where <feature> <all/group/private>
- Set numbers: .settings set <feature> <value>
- Manage lists: .settings add/remove/list <list> <item>

*EXAMPLES*
.settings antilink on
.settings where autoReact group
.settings set warnLimit 5
.settings add scam win
.settings list scam

*AVAILABLE LANGUAGES*
English, Swahili, Hausa, Hindi, Arabic, Spanish, French, Portuguese, Chinese, Russian, German, Italian, Japanese, Korean

Type .help <language> to see this in your language.
                `
            },
            sw: {
                name: "Kiswahili",
                help: `
╭─── • 🥀 • ───╮
   *USAIDIZI WA BOT INSIDIOUS*
╰─── • 🥀 • ───╯

*AMRI ZA JUMLA*
▸ .help [lugha] - Onyesha usaidizi huu kwa lugha yako
▸ .ping - Angalia muda wa majibu
▸ .alive - Angalia hali ya bot
▸ .mode - Tazama hali ya sasa ya bot
▸ .settings - Dhibiti mipangilio ya bot (mmiliki pekee)
▸ .groupsettings - Dhibiti mipangilio ya kikundi (wasimamizi)

*VIPIMO VYA KINGA* (vinaweza kuwashwa kwa kila kikundi)
▸ antilink - Futa ujumbe wenye viungo
▸ antiporn - Zuia maudhui ya ngono
▸ antiscam - Tambua na futa ujumbe wa ulaghai
▸ antimedia - Zuia aina fulani za midia (picha, video, stika)
▸ antitag - Zuia kutaja watu wengi kupita kiasi
▸ sleepingmode - Funga kikundi kiotomatiki usiku
▸ antispam - Weka kikomo cha ujumbe kwa muda
▸ anticall - Kata simu na uzuie watesi
▸ antistatusmention - Onya/zuia watumiaji wanaotaja bot kwenye hadhi

*VIPIMO VYA KIAUTO* (kote au kwa kila kikundi)
▸ autoRead - Soma ujumbe kiotomatiki (eneo: all/group/private)
▸ autoReact - Jibu kiotomatiki kwa emoji (eneo)
▸ autoTyping - Onyesha kuandika
▸ autoRecording - Onyesha kurekodi (mazungumzo binafsi)
▸ autoBio - Sasisha wasifu wa bot
▸ autostatus - Tazama/jibu kwa hadhi kiotomatiki
▸ downloadStatus - Pakua midia ya hadhi (mmiliki pekee)
▸ autoSaveContact - Hifadhi anwani mpya kiotomatiki
▸ autoDeleteMessages - Futa ujumbe uliosambazwa baada ya muda

*USIMAMIZI WA VIKUNDI*
▸ welcomeGoodbye - Tuma ujumbe wa kukaribisha/kuaga
▸ activemembers - Ondoa washiriki wasiofanya kazi
▸ autoblockCountry - Zuia watumiaji kutoka nchi fulani

*CHATBOT*
▸ chatbot - Wezesha majibu ya AI (eneo)

*MIPANGILIO*
Tumia .settings kusanidi kote.
Tumia .groupsettings kusanidi kwa kila kikundi.

Kwa mipangilio ya namba:
▸ warnLimit - Idadi ya maonyo kabla ya kuondolewa
▸ maxTags - Idadi ya kutaja inayoruhusiwa kwa ujumbe mmoja
▸ inactiveDays - Siku za kutofanya kazi kabla ya kuondolewa
▸ antiSpamLimit - Ujumbe kwa muda
▸ antiSpamInterval - Muda kwa millisecond
▸ sleepingStart/End - Muda wa kulala kwa kikundi
▸ maxCoOwners - Idadi ya wamiliki wenza
▸ statusReplyLimit - Kikomo cha majibu ya hadhi kwa siku
▸ autoExpireMinutes - Dakika kabla ya kufuta kiotomatiki

*ORODHA* (zinaweza kudhibitiwa kwa .settings)
▸ scamKeywords - Maneno yanayoashiria ulaghai
▸ pornKeywords - Maneno yanayoashiria ngono
▸ blockedMediaTypes - Aina za midia za kuzuia
▸ autoReactEmojis - Emoji za kujibu kiotomatiki
▸ blockedCountries - Namba za nchi za kuzuia

*JINSI YA KUTUMIA*
- Washa/zima vipimo: .settings <kitu> on/off
- Weka eneo: .settings where <kitu> <all/group/private>
- Weka namba: .settings set <kitu> <thamani>
- Dhibiti orodha: .settings add/remove/list <orodha> <kitu>

*MFANO*
.settings antilink on
.settings where autoReact group
.settings set warnLimit 5
.settings add scam win
.settings list scam

*LUGHA ZINAZOPATIKANA*
Kiingereza, Kiswahili, Kihausa, Kihindi, Kiarabu, Kihispania, Kifaransa, Kireno, Kichina, Kirusi, Kijerumani, Kiitaliano, Kijapani, Kikorea

Chapa .help <lugha> kuona usaidizi huu kwa lugha yako.
                `
            },
            // Fallback languages (will show English with a note)
            ha: { name: "Hausa", help: null },
            hi: { name: "Hindi", help: null },
            ar: { name: "Arabic", help: null },
            es: { name: "Spanish", help: null },
            fr: { name: "French", help: null },
            pt: { name: "Portuguese", help: null },
            zh: { name: "Chinese", help: null },
            ru: { name: "Russian", help: null },
            de: { name: "German", help: null },
            it: { name: "Italian", help: null },
            ja: { name: "Japanese", help: null },
            ko: { name: "Korean", help: null }
        };

        // Map language names to codes (case-insensitive)
        const langMap = {
            english: "en", eng: "en",
            swahili: "sw", kiswahili: "sw", swa: "sw",
            hausa: "ha", ha: "ha",
            hindi: "hi", hi: "hi",
            arabic: "ar", ar: "ar",
            spanish: "es", es: "es",
            french: "fr", fr: "fr",
            portuguese: "pt", pt: "pt",
            chinese: "zh", zh: "zh",
            russian: "ru", ru: "ru",
            german: "de", de: "de",
            italian: "it", it: "it",
            japanese: "ja", ja: "ja",
            korean: "ko", ko: "ko"
        };

        // ==================== DETERMINE LANGUAGE ====================
        let targetLang = "en"; // default
        if (args.length > 0) {
            const userLang = args.join(" ").toLowerCase().trim();
            // Try to find matching language code
            for (const [name, code] of Object.entries(langMap)) {
                if (userLang === name || userLang === code) {
                    targetLang = code;
                    break;
                }
            }
            // If not found, show available languages list
            if (!languages[targetLang]) {
                const available = Object.entries(languages)
                    .map(([code, data]) => `▸ ${data.name} (${code})`)
                    .join("\n");
                const msgText = `❌ Language not recognised.\n\n*Available languages:*\n${available}\n\nExample: .help swahili`;
                return reply(fancy(msgText));
            }
        } else {
            // No language provided – show short language menu
            const available = Object.entries(languages)
                .map(([code, data]) => `▸ ${data.name} (${code})`)
                .join("\n");
            const menu = `╭─── • 🥀 • ───╮\n   *HELP MENU*   \n╰─── • 🥀 • ───╯\n\nPlease choose a language by typing:\n.help <language>\n\n${available}`;
            return reply(fancy(menu));
        }

        // ==================== GET HELP TEXT ====================
        let helpText = languages[targetLang].help;
        if (!helpText) {
            // Fallback to English with note
            helpText = languages.en.help + `\n\n*Note:* Full translation for ${languages[targetLang].name} is not yet available. Showing English version.`;
        }

        // ==================== SEND HELP ====================
        // Optionally send as image with newsletter forward
        const settings = await handler?.loadGlobalSettings?.() || {};
        const botImage = settings.botImage || "https://files.catbox.moe/f3c07u.jpg";
        const newsletterJid = settings.newsletterJid || "120363404317544295@newsletter";
        const newsletterName = settings.botName || "INSIDIOUS";

        await conn.sendMessage(from, {
            image: { url: botImage },
            caption: fancy(helpText),
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: newsletterJid,
                    newsletterName: newsletterName
                }
            }
        }, { quoted: msg }).catch(async () => {
            // If image fails, send as text
            await conn.sendMessage(from, { text: fancy(helpText) }, { quoted: msg });
        });
    }
};