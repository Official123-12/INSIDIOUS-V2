const fs = require('fs');

function getConfig(key, defaultValue) {
    if (process.env[key]) return process.env[key];
    try {
        const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
            if (line && !line.startsWith('#') && line.includes('=')) {
                const [k, v] = line.split('=');
                acc[k.trim()] = v.trim().replace(/"/g, '').replace(/'/g, '');
            }
            return acc;
        }, {});
        return env[key] || defaultValue;
    } catch {
        return defaultValue;
    }
}

function parseArray(value, defaultValue = []) {
    return value ? value.split(',').map(v => v.trim()).filter(v => v) : defaultValue;
}

module.exports = {
    botName: getConfig('BOT_NAME', "INSIDIOUS: THE LAST KEY"),
    developer: getConfig('DEVELOPER_NAME', "STANYTZ"),
    developerName: getConfig('DEVELOPER_NAME', "STANYTZ"),
    ownerNumber: parseArray(getConfig('OWNER_NUMBER', "255000000000")),
    version: getConfig('VERSION', "2.1.1"),
    year: getConfig('YEAR', "2025"),
    updated: getConfig('UPDATED', "2026"),
    specialThanks: getConfig('SPECIAL_THANKS', "REDTECH"),

    prefix: getConfig('BOT_PREFIX', "."),
    mode: getConfig('BOT_MODE', "public"),
    commandWithoutPrefix: getConfig('COMMAND_WITHOUT_PREFIX', "false") === "true",

    newsletterJid: getConfig('NEWSLETTER_JID', "120363404317544295@newsletter"),
    requiredGroupJid: getConfig('GROUP_JID', "120363406549688641@g.us"),
    requiredGroupInvite: getConfig('GROUP_INVITE', "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y"),
    autoFollowChannels: parseArray(getConfig('AUTO_FOLLOW_CHANNELS', "120363404317544295@newsletter")),

    mongodb: getConfig('MONGODB_URI', "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious"),

    // Security features
    antilink: getConfig('ANTILINK', "true") === "true",
    antiporn: getConfig('ANTIPORN', "true") === "true",
    antiscam: getConfig('ANTISCAM', "true") === "true",
    antimedia: getConfig('ANTIMEDIA', "false") === "true",
    antitag: getConfig('ANTITAG', "true") === "true",
    antiviewonce: getConfig('ANTIVIEWONCE', "true") === "true",
    antidelete: getConfig('ANTIDELETE', "true") === "true",
    sleepingmode: getConfig('SLEEPING_MODE', "true") === "true",
    antibugs: getConfig('ANTIBUGS', "true") === "true",
    antispam: getConfig('ANTISPAM', "true") === "true",
    anticall: getConfig('ANTICALL', "true") === "true",

    // Auto features
    autoRead: getConfig('AUTO_READ', "true") === "true",
    autoReact: getConfig('AUTO_REACT', "true") === "true",
    autoTyping: getConfig('AUTO_TYPING', "true") === "true",
    autoRecording: getConfig('AUTO_RECORDING', "true") === "true",
    autoBio: getConfig('AUTO_BIO', "true") === "true",
    autostatus: getConfig('AUTO_STATUS', "true") === "true",
    downloadStatus: getConfig('DOWNLOAD_STATUS', "true") === "true",
    autoSaveContact: getConfig('AUTO_SAVE_CONTACT', "false") === "true",

    welcomeGoodbye: getConfig('WELCOME_GOODBYE', "true") === "true",
    activemembers: getConfig('ACTIVE_MEMBERS', "true") === "true",
    autoblockCountry: getConfig('AUTOBLOCK_COUNTRY', "false") === "true",

    chatbot: getConfig('CHATBOT', "true") === "true",

    warnLimit: parseInt(getConfig('WARN_LIMIT', "3")),
    maxTags: parseInt(getConfig('MAX_TAGS', "5")),
    inactiveDays: parseInt(getConfig('INACTIVE_DAYS', "7")),
    antiSpamLimit: parseInt(getConfig('ANTISPAM_LIMIT', "5")),
    antiSpamInterval: parseInt(getConfig('ANTISPAM_INTERVAL', "10000")),
    sleepingStart: getConfig('SLEEPING_START', "23:00"),
    sleepingEnd: getConfig('SLEEPING_END', "06:00"),
    maxCoOwners: parseInt(getConfig('MAX_CO_OWNERS', "2")),

    statusReplyLimit: parseInt(getConfig('STATUS_REPLY_LIMIT', "50")),
    autoExpireMinutes: parseInt(getConfig('AUTO_EXPIRE_MINUTES', "10")),

    scamKeywords: parseArray(getConfig('SCAM_KEYWORDS', 'win,prize,lotto,congratulations,selected,million,inheritance')),
    pornKeywords: parseArray(getConfig('PORN_KEYWORDS', 'porn,sex,xxx,adult,18+,nude,onlyfans')),
    blockedMediaTypes: parseArray(getConfig('BLOCKED_MEDIA_TYPES', 'photo,video,sticker')),
    blockedCountries: parseArray(getConfig('BLOCKED_COUNTRIES', '')),

    autoReactEmojis: parseArray(getConfig('AUTO_REACT_EMOJIS', '❤️,🔥,👍,🎉,👏,⚡,✨,🌟')),
    autoStatusActions: parseArray(getConfig('AUTO_STATUS_ACTIONS', 'view,react,reply')),

    quoteApiUrl: getConfig('QUOTE_API_URL', 'https://api.quotable.io/random'),
    aiApiUrl: getConfig('AI_API_URL', 'https://text.pollinations.ai/'),
    pornFilterApiKey: getConfig('PORN_FILTER_API_KEY', ''),

    botImage: getConfig('BOT_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    aliveImage: getConfig('ALIVE_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    menuImage: getConfig('MENU_IMAGE', 'https://files.catbox.moe/irqrap.jpg'),
    footer: getConfig('FOOTER', "© 2025 INSIDIOUS V2.1.1 | Developer: STANYTZ"),

    port: parseInt(getConfig('PORT', 3000)),
    host: getConfig('HOST', "0.0.0.0"),

    adminNumbers: parseArray(getConfig('ADMIN_NUMBERS', '')),
};