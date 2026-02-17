const fs = require('fs');

// ==================== LOAD .ENV FILE ====================
let envConfig = {};
try {
    if (fs.existsSync('.env')) {
        const envFile = fs.readFileSync('.env', 'utf8');
        envFile.split('\n').forEach(line => {
            if (line && !line.startsWith('#') && line.includes('=')) {
                const [key, value] = line.split('=');
                if (key && value) {
                    envConfig[key.trim()] = value.trim().replace(/"/g, '').replace(/'/g, '');
                }
            }
        });
        console.log('✅ Loaded .env file');
    }
} catch (e) {
    console.log('⚠️ No .env file found');
}

function getConfig(key, defaultValue) {
    if (process.env[key]) return process.env[key];
    if (envConfig[key]) return envConfig[key];
    return defaultValue;
}

// Helper to parse array from string (comma separated)
function parseArray(value, defaultValue = []) {
    if (!value) return defaultValue;
    return value.split(',').map(v => v.trim()).filter(v => v);
}

module.exports = {
    // ==================== BOT METADATA ====================
    botName: getConfig('BOT_NAME', "INSIDIOUS: THE LAST KEY"),
    developer: getConfig('DEVELOPER_NAME', "STANYTZ"),
    developerName: getConfig('DEVELOPER_NAME', "STANYTZ"),
    ownerName: getConfig('BOT_OWNER', "STANY"),
    ownerNumber: parseArray(getConfig('OWNER_NUMBER', "255000000000")),
    version: getConfig('VERSION', "2.1.1"),
    year: getConfig('YEAR', "2025"),
    updated: getConfig('UPDATED', "2026"),
    specialThanks: getConfig('SPECIAL_THANKS', "REDTECH"),

    // ==================== COMMANDS ====================
    prefix: getConfig('BOT_PREFIX', "."),
    mode: getConfig('BOT_MODE', "public"),
    commandWithoutPrefix: getConfig('COMMAND_WITHOUT_PREFIX', "true") === "true",

    // ==================== CHANNEL / GROUP ====================
    newsletterJid: getConfig('NEWSLETTER_JID', "120363404317544295@newsletter"),
    requiredGroupJid: getConfig('GROUP_JID', "120363406549688641@g.us"),
    requiredGroupInvite: getConfig('GROUP_INVITE', "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y"),
    autoFollowChannels: parseArray(getConfig('AUTO_FOLLOW_CHANNELS', "120363404317544295@newsletter")),

    // ==================== DATABASE ====================
    mongodb: getConfig('MONGODB_URI', "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious"),

    // ==================== ANTI / SECURITY FEATURES ====================
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

    // ==================== AUTO FEATURES ====================
    autoRead: getConfig('AUTO_READ', "true") === "true",
    autoReact: getConfig('AUTO_REACT', "true") === "true",
    autoTyping: getConfig('AUTO_TYPING', "true") === "true",
    autoRecording: getConfig('AUTO_RECORDING', "true") === "true",
    autoBio: getConfig('AUTO_BIO', "true") === "true",
    autostatus: getConfig('AUTO_STATUS', "true") === "true",
    downloadStatus: getConfig('DOWNLOAD_STATUS', "true") === "true",

    // ==================== GROUP MANAGEMENT ====================
    welcomeGoodbye: getConfig('WELCOME_GOODBYE', "true") === "true",
    activemembers: getConfig('ACTIVE_MEMBERS', "true") === "true",
    autoblockCountry: getConfig('AUTOBLOCK_COUNTRY', "false") === "true",

    // ==================== AI ====================
    chatbot: getConfig('CHATBOT', "true") === "true",

    // ==================== THRESHOLDS & LIMITS ====================
    warnLimit: parseInt(getConfig('WARN_LIMIT', "3")),
    maxTags: parseInt(getConfig('MAX_TAGS', "5")),
    inactiveDays: parseInt(getConfig('INACTIVE_DAYS', "7")),
    antiSpamLimit: parseInt(getConfig('ANTISPAM_LIMIT', "5")),
    antiSpamInterval: parseInt(getConfig('ANTISPAM_INTERVAL', "10000")), // ms
    sleepingStart: getConfig('SLEEPING_START', "23:00"),
    sleepingEnd: getConfig('SLEEPING_END', "06:00"),
    maxCoOwners: parseInt(getConfig('MAX_CO_OWNERS', "2")),

    // ==================== KEYWORDS (ARRAYS) ====================
    scamKeywords: parseArray(
        getConfig('SCAM_KEYWORDS', 
            'investment,bitcoin,crypto,ashinde,zawadi,gift card,telegram.me,pata pesa,ajira,pesa haraka,mtaji,uwekezaji,double money,win prize,lottery,congratulations,million,inheritance,selected'
        )
    ),
    pornKeywords: parseArray(
        getConfig('PORN_KEYWORDS',
            'porn,sex,xxx,ngono,video za kikubwa,hentai,malaya,pussy,dick,fuck,ass,boobs,nude,nudes,adult,18+,onlyfans'
        )
    ),
    blockedMediaTypes: parseArray(
        getConfig('BLOCKED_MEDIA_TYPES', 'photo,video,sticker')
    ),
    blockedCountries: parseArray(getConfig('BLOCKED_COUNTRIES', '')),

    // ==================== AUTO REACT / STATUS ====================
    autoReactEmojis: parseArray(
        getConfig('AUTO_REACT_EMOJIS', '❤️,🔥,👍,🎉,👏,⚡,✨,🌟,💯,✅')
    ),
    autoStatusActions: parseArray(
        getConfig('AUTO_STATUS_ACTIONS', 'view,react,reply')
    ),

    // ==================== API KEYS ====================
    quoteApiUrl: getConfig('QUOTE_API_URL', 'https://api.quotable.io/random'),
    aiApiUrl: getConfig('AI_API_URL', 'https://text.pollinations.ai/'),

    // ==================== VISUALS ====================
    botImage: getConfig('BOT_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    aliveImage: getConfig('ALIVE_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    menuImage: getConfig('MENU_IMAGE', 'https://files.catbox.moe/irqrap.jpg'),
    menuAudio: getConfig('MENU_AUDIO', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'),
    footer: getConfig('FOOTER', "© 2025-2026 INSIDIOUS V2.1.1 | Developer: STANYTZ"),

    // ==================== SERVER ====================
    port: parseInt(getConfig('PORT', 3000)),
    host: getConfig('HOST', "0.0.0.0"),

    // ==================== ADMIN (for direct usage) ====================
    adminNumbers: parseArray(getConfig('ADMIN_NUMBERS', '')),

    // ==================== NEW SETTINGS (MISSING ISSUES ADDED) ====================
    // Limit for auto status replies per user per day
    autoStatusLimit: parseInt(getConfig('AUTO_STATUS_LIMIT', '10')),

    // Scope for auto react: 'all', 'group', 'private'
    autoReactScope: getConfig('AUTO_REACT_SCOPE', 'all'),

    // Scope for auto read: 'all', 'group', 'private'
    autoReadScope: getConfig('AUTO_READ_SCOPE', 'all'),

    // Always online presence
    alwaysOnline: getConfig('ALWAYS_ONLINE', 'true') === 'true',

    // Image for settings carousel (optional, falls back to menuImage)
    settingsImage: getConfig('SETTINGS_IMAGE', 'https://files.catbox.moe/irqrap.jpg'),

    // Audio for settings carousel (optional)
    settingsAudio: getConfig('SETTINGS_AUDIO', ''),

    // Category images (optional, for menu)
    categoryImages: {
        general: getConfig('CAT_IMAGE_GENERAL', 'https://files.catbox.moe/mfngio.png'),
        owner: getConfig('CAT_IMAGE_OWNER', 'https://files.catbox.moe/mfngio.png'),
        group: getConfig('CAT_IMAGE_GROUP', 'https://files.catbox.moe/mfngio.png'),
        // add more as needed
    },

    // Category audio (optional)
    categoryAudio: {
        general: getConfig('CAT_AUDIO_GENERAL', ''),
        owner: getConfig('CAT_AUDIO_OWNER', ''),
        group: getConfig('CAT_AUDIO_GROUP', ''),
    },
};