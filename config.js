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
    developerName: getConfig('DEVELOPER_NAME', "STANYTZ"),      // alias for commands
    ownerName: getConfig('BOT_OWNER', "STANY"),
    ownerNumber: parseArray(getConfig('OWNER_NUMBER', "255000000000,255123456789")),
    version: getConfig('VERSION', "2.1.1"),
    year: getConfig('YEAR', "2025"),
    updated: getConfig('UPDATED', "2026"),
    specialThanks: getConfig('SPECIAL_THANKS', "REDTECH"),

    // ==================== COMMANDS ====================
    prefix: getConfig('BOT_PREFIX', "."),
    mode: getConfig('BOT_MODE', "public"),                    // 'public' or 'self'
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

    // ==================== KEYWORDS (ARRAYS) - Kwa Anti Features ====================
    // Scam keywords - maneno yanayotambua utapeli
    scamKeywords: parseArray(
        getConfig('SCAM_KEYWORDS', 
            'investment,bitcoin,crypto,ashinde,zawadi,gift card,telegram.me,pata pesa,ajira,pesa haraka,mtaji,uwekezaji,double money,win prize,lottery,congratulations,million,inheritance,selected'
        )
    ),
    
    // Porn keywords - maneno yenye dharau za ngono
    pornKeywords: parseArray(
        getConfig('PORN_KEYWORDS',
            'porn,sex,xxx,ngono,video za kikubwa,hentai,malaya,pussy,dick,fuck,ass,boobs,nude,nudes,adult,18+,onlyfans'
        )
    ),
    
    // Aina za media zinazozuiwa (photo,video,sticker,audio,document,all)
    blockedMediaTypes: parseArray(
        getConfig('BLOCKED_MEDIA_TYPES', 'photo,video,sticker')
    ),
    
    // Nchi zilizozuiwa (kwa mfano: 255,254,256)
    blockedCountries: parseArray(getConfig('BLOCKED_COUNTRIES', '')),

    // ==================== AUTO REACT / STATUS ====================
    autoReactEmojis: parseArray(
        getConfig('AUTO_REACT_EMOJIS', '❤️,🔥,👍,🎉,👏,⚡,✨,🌟,💯,✅')
    ),
    
    autoStatusActions: parseArray(
        getConfig('AUTO_STATUS_ACTIONS', 'view,react,reply')
    ),

    // ==================== API KEYS & URLs ====================
    quoteApiUrl: getConfig('QUOTE_API_URL', 'https://api.quotable.io/random'),
    aiApiUrl: getConfig('AI_API_URL', 'https://text.pollinations.ai/'),

    // ==================== VISUALS & MEDIA ====================
    botImage: getConfig('BOT_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    aliveImage: getConfig('ALIVE_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    menuImage: getConfig('MENU_IMAGE', 'https://files.catbox.moe/irqrap.jpg'),
    menuAudio: getConfig('MENU_AUDIO', 'https://eliteprotech-url.zone.id/1771163123472g2ktsd.mp3'),
    
    // Footer inayoonekana kwenye menu na messages
    footer: getConfig('FOOTER', "© 2025-2026 INSIDIOUS V2.1.1 | Developer: STANYTZ"),

    // ==================== SERVER SETTINGS ====================
    port: parseInt(getConfig('PORT', 3000)),
    host: getConfig('HOST', "0.0.0.0"),

    // ==================== ADMIN NUMBERS (Co-owners wa ziada) ====================
    adminNumbers: parseArray(getConfig('ADMIN_NUMBERS', '')),

    // ==================== PAIRING SETTINGS ====================
    maxPairingAttempts: parseInt(getConfig('MAX_PAIRING_ATTEMPTS', "3")),
    pairingTimeout: parseInt(getConfig('PAIRING_TIMEOUT', "300000")), // 5 minutes in ms

    // ==================== SESSION & AUTH ====================
    sessionName: getConfig('SESSION_NAME', 'session'),
    authFolder: getConfig('AUTH_FOLDER', 'auth'),

    // ==================== LOGGING ====================
    debug: getConfig('DEBUG', "false") === "true",
    logLevel: getConfig('LOG_LEVEL', "info"), // error, warn, info, debug

    // ==================== DOWNLOAD SETTINGS ====================
    downloadPath: getConfig('DOWNLOAD_PATH', './downloads'),
    maxFileSize: parseInt(getConfig('MAX_FILE_SIZE', "100")), // MB

    // ==================== TIMEZONE ====================
    timezone: getConfig('TIMEZONE', 'Africa/Dar_es_Salaam'),

    // ==================== CRON SCHEDULES (Ili kubadilisha nyakati) ====================
    autoBioCron: getConfig('AUTO_BIO_CRON', '*/1 * * * *'), // kila dakika 1
    inactiveCheckCron: getConfig('INACTIVE_CHECK_CRON', '0 0 * * *'), // kila siku saa 12 usiku
    sleepingCheckCron: getConfig('SLEEPING_CHECK_CRON', '* * * * *'), // kila dakika

    // ==================== FEATURE TOGGLES (Advanced) ====================
    enablePairing: getConfig('ENABLE_PAIRING', "true") === "true",
    enableGroups: getConfig('ENABLE_GROUPS', "true") === "true",
    enablePrivate: getConfig('ENABLE_PRIVATE', "true") === "true",
    enableStatus: getConfig('ENABLE_STATUS', "true") === "true",
    enableNewsletter: getConfig('ENABLE_NEWSLETTER', "true") === "true",

    // ==================== NEW: MENU & SETTINGS VISUALS ====================
    settingsImage: getConfig('SETTINGS_IMAGE', 'https://files.catbox.moe/irqrap.jpg'),
    settingsAudio: getConfig('SETTINGS_AUDIO', 'https://eliteprotech-url.zone.id/1771163123472g2ktsd.mp3'),

    // ==================== Picha za Kila Category (kwa menu) ====================
    categoryImages: {
        general: getConfig('CAT_IMAGE_GENERAL', 'https://files.catbox.moe/mfngio.png'),
        group: getConfig('CAT_IMAGE_GROUP', 'https://files.catbox.moe/mfngio.png'),
        owner: getConfig('CAT_IMAGE_OWNER', 'https://files.catbox.moe/mfngio.png'),
        downloader: getConfig('CAT_IMAGE_DOWNLOADER', 'https://files.catbox.moe/mfngio.png'),
        converter: getConfig('CAT_IMAGE_CONVERTER', 'https://files.catbox.moe/mfngio.png'),
        fun: getConfig('CAT_IMAGE_FUN', 'https://files.catbox.moe/mfngio.png'),
        economy: getConfig('CAT_IMAGE_ECONOMY', 'https://files.catbox.moe/mfngio.png'),
        education: getConfig('CAT_IMAGE_EDUCATION', 'https://files.catbox.moe/mfngio.png'),
        ai: getConfig('CAT_IMAGE_AI', 'https://files.catbox.moe/mfngio.png'),
        tools: getConfig('CAT_IMAGE_TOOLS', 'https://files.catbox.moe/mfngio.png'),
        games: getConfig('CAT_IMAGE_GAMES', 'https://files.catbox.moe/mfngio.png'),
    },

    // ==================== Sauti za Kila Category (kwa menu) ====================
    categoryAudio: {
        general: getConfig('CAT_AUDIO_GENERAL', ''),
        group: getConfig('CAT_AUDIO_GROUP', ''),
        owner: getConfig('CAT_AUDIO_OWNER', ''),
        downloader: getConfig('CAT_AUDIO_DOWNLOADER', ''),
        converter: getConfig('CAT_AUDIO_CONVERTER', ''),
        fun: getConfig('CAT_AUDIO_FUN', ''),
        economy: getConfig('CAT_AUDIO_ECONOMY', ''),
        education: getConfig('CAT_AUDIO_EDUCATION', ''),
        ai: getConfig('CAT_AUDIO_AI', ''),
        tools: getConfig('CAT_AUDIO_TOOLS', ''),
        games: getConfig('CAT_AUDIO_GAMES', ''),
    }
};