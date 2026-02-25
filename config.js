const fs = require('fs');
const path = require('path');

/**
 * 🚀 INSIDIOUS BOT V2.2 - COMPLETE CONFIGURATION
 * 👑 Developer: STANYTZ
 * 📧 Email: officialstanlee143@gmail.com
 * 📱 Phone: +255787069580
 *  Year: 2025-2026
 */

function getConfig(key, defaultValue) {
    if (process.env[key]) return process.env[key];
    try {
        const envPath = path.join(process.cwd(), '.env');
        const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
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
    // ═══════════════════════════════════════════════════════════
    // 👤 BOT IDENTITY & DEVELOPER INFO
    // ═══════════════════════════════════════════════════════════
    botName: getConfig('BOT_NAME', "INSIDIOUS: THE LAST KEY"),
    developer: getConfig('DEVELOPER_NAME', "STANYTZ"),
    developerName: getConfig('DEVELOPER_NAME', "STANYTZ"),
    ownerNumber: getConfig('OWNER_NUMBER', "255787069580"),
    supportEmail: getConfig('SUPPORT_EMAIL', "officialstanlee143@gmail.com"),
    version: getConfig('VERSION', "2.2.0"),
    year: getConfig('YEAR', "2025"),
    updated: getConfig('UPDATED', "2026"),
    specialThanks: getConfig('SPECIAL_THANKS', "REDTECH"),

    // ═══════════════════════════════════════════════════════════
    // 🔗 OFFICIAL LINKS & CHANNELS
    // ═══════════════════════════════════════════════════════════
    channelUrl: getConfig('CHANNEL_URL', "https://whatsapp.com/channel/stanytz"),
    websiteUrl: getConfig('WEBSITE_URL', "https://insidious-bot.vercel.app"),
    githubUrl: getConfig('GITHUB_URL', "https://github.com/stanytz/insidious"),
    telegramUrl: getConfig('TELEGRAM_URL', "https://t.me/insidious_support"),
    twitterUrl: getConfig('TWITTER_URL', "https://twitter.com/stanytz"),

    // ═══════════════════════════════════════════════════════════
    // 🖼️ IMAGES & MEDIA
    // ═══════════════════════════════════════════════════════════
    botImage: getConfig('BOT_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    aliveImage: getConfig('ALIVE_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    menuImage: getConfig('MENU_IMAGE', 'https://files.catbox.moe/irqrap.jpg'),
    menuImage2: getConfig('MENU_IMAGE2', 'https://files.catbox.moe/59ays3.jpg'),
    menuImage3: getConfig('MENU_IMAGE3', 'https://files.catbox.moe/mfngio.png'),
    thumbnailUrl: getConfig('THUMBNAIL_URL', 'https://files.catbox.moe/mfngio.png'),

    // ═══════════════════════════════════════════════════════════
    // ⚙️ BOT SETTINGS & MODE
    // ═══════════════════════════════════════════════════════════
    prefix: getConfig('BOT_PREFIX', "."),
    mode: getConfig('BOT_MODE', "public"), // public, private, group
    commandWithoutPrefix: getConfig('COMMAND_WITHOUT_PREFIX', "false") === "true",
    language: getConfig('LANGUAGE', "en"), // en, sw, auto

    // ═══════════════════════════════════════════════════════════
    // 📱 WHATSAPP INTEGRATION
    // ═══════════════════════════════════════════════════════════
    newsletterJid: getConfig('NEWSLETTER_JID', "120363404317544295@newsletter"),
    requiredGroupJid: getConfig('GROUP_JID', "120363406549688641@g.us"),
    requiredGroupInvite: getConfig('GROUP_INVITE', "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y"),
    autoFollowChannels: parseArray(getConfig('AUTO_FOLLOW_CHANNELS', "120363404317544295@newsletter")),

    // ═══════════════════════════════════════════════════════════
    // 🗄️ DATABASE CONFIGURATION
    // ═══════════════════════════════════════════════════════════
    mongodb: getConfig('MONGODB_URI', "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious"),
    useDatabase: getConfig('USE_DATABASE', "true") === "true",
    databaseType: getConfig('DATABASE_TYPE', "mongodb"), // mongodb, sqlite, firebase

    // ═══════════════════════════════════════════════════════════
    // 🛡️ SECURITY FEATURES
    // ═══════════════════════════════════════════════════════════
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
    antiblock: getConfig('ANTIBLOCK', "false") === "true",

    // ═══════════════════════════════════════════════════════════
    // 🤖 AUTO FEATURES
    // ═══════════════════════════════════════════════════════════
    autoRead: getConfig('AUTO_READ', "true") === "true",
    autoReact: getConfig('AUTO_REACT', "true") === "true",
    autoTyping: getConfig('AUTO_TYPING', "true") === "true",
    autoRecording: getConfig('AUTO_RECORDING', "false") === "true",
    autoBio: getConfig('AUTO_BIO', "true") === "true",
    autostatus: getConfig('AUTO_STATUS', "true") === "true",
    downloadStatus: getConfig('DOWNLOAD_STATUS', "true") === "true",
    autoSaveContact: getConfig('AUTO_SAVE_CONTACT', "false") === "true",
    autoReply: getConfig('AUTO_REPLY', "false") === "true",
    autoSticker: getConfig('AUTO_STICKER', "false") === "true",

    // ═══════════════════════════════════════════════════════════
    // 👥 GROUP MANAGEMENT
    // ═══════════════════════════════════════════════════════════
    welcomeGoodbye: getConfig('WELCOME_GOODBYE', "true") === "true",
    activemembers: getConfig('ACTIVE_MEMBERS', "true") === "true",
    autoblockCountry: getConfig('AUTOBLOCK_COUNTRY', "false") === "true",
    groupOnly: getConfig('GROUP_ONLY', "false") === "true",

    // ═══════════════════════════════════════════════════════════
    // 💬 CHATBOT & AI
    // ═══════════════════════════════════════════════════════════
    chatbot: getConfig('CHATBOT', "true") === "true",
    aiEnabled: getConfig('AI_ENABLED', "true") === "true",

    // ═══════════════════════════════════════════════════════════
    // ⚠️ LIMITS & THRESHOLDS
    // ═══════════════════════════════════════════════════════════
    warnLimit: parseInt(getConfig('WARN_LIMIT', "3")),
    maxTags: parseInt(getConfig('MAX_TAGS', "5")),
    inactiveDays: parseInt(getConfig('INACTIVE_DAYS', "7")),
    antiSpamLimit: parseInt(getConfig('ANTISPAM_LIMIT', "5")),
    antiSpamInterval: parseInt(getConfig('ANTISPAM_INTERVAL', "10000")),
    statusReplyLimit: parseInt(getConfig('STATUS_REPLY_LIMIT', "50")),
    autoExpireMinutes: parseInt(getConfig('AUTO_EXPIRE_MINUTES', "10")),
    maxCoOwners: parseInt(getConfig('MAX_CO_OWNERS', "2")),
    maxFileSize: parseInt(getConfig('MAX_FILE_SIZE', "100")), // MB

    // ═══════════════════════════════════════════════════════════
    //  SLEEP MODE SETTINGS
    // ═══════════════════════════════════════════════════════════
    sleepingStart: getConfig('SLEEPING_START', "23:00"),
    sleepingEnd: getConfig('SLEEPING_END', "06:00"),
    sleepingTimezone: getConfig('SLEEPING_TIMEZONE', "Africa/Dar_es_Salaam"),

    // ═══════════════════════════════════════════════════════════
    // 🚫 FILTERS & KEYWORDS
    // ═══════════════════════════════════════════════════════════
    scamKeywords: parseArray(getConfig('SCAM_KEYWORDS', 'win,prize,lotto,congratulations,selected,million,inheritance,bitcoin,crypto')),
    pornKeywords: parseArray(getConfig('PORN_KEYWORDS', 'porn,sex,xxx,adult,18+,nude,onlyfans,hentai')),
    blockedMediaTypes: parseArray(getConfig('BLOCKED_MEDIA_TYPES', 'photo,video,sticker')),
    blockedCountries: parseArray(getConfig('BLOCKED_COUNTRIES', '')),
    allowedJids: parseArray(getConfig('ALLOWED_JIDS', '')),
    blockedJids: parseArray(getConfig('BLOCKED_JIDS', '')),

    // ═══════════════════════════════════════════════════════════
    // ✨ AUTO REACTIONS & STATUS
    // ═══════════════════════════════════════════════════════════
    autoReactEmojis: parseArray(getConfig('AUTO_REACT_EMOJIS', '❤️,🔥,,🎉,,⚡,✨,🌟,💯,🎊')),
    autoStatusActions: parseArray(getConfig('AUTO_STATUS_ACTIONS', 'view,react,reply')),
    statusReplyMessage: getConfig('STATUS_REPLY_MESSAGE', "Thanks for the status! 🔥"),

    // ═══════════════════════════════════════════════════════════
    // 🔌 API KEYS & EXTERNAL SERVICES
    // ═══════════════════════════════════════════════════════════
    quoteApiUrl: getConfig('QUOTE_API_URL', 'https://api.quotable.io/random'),
    aiApiUrl: getConfig('AI_API_URL', 'https://text.pollinations.ai/'),
    weatherApiKey: getConfig('WEATHER_API_KEY', ''), // Get from openweathermap.org
    openaiApiKey: getConfig('OPENAI_API_KEY', ''),
    geminiApiKey: getConfig('GEMINI_API_KEY', ''),
    pornFilterApiKey: getConfig('PORN_FILTER_API_KEY', ''),
    removeBgApiKey: getConfig('REMOVE_BG_API_KEY', ''),

    // ═══════════════════════════════════════════════════════════
    // ️ SERVER & NETWORKING
    // ═══════════════════════════════════════════════════════════
    port: parseInt(getConfig('PORT', 3000)),
    host: getConfig('HOST', "0.0.0.0"),
    callbackUrl: getConfig('CALLBACK_URL', ''),
    webhookUrl: getConfig('WEBHOOK_URL', ''),
    reportWebhook: getConfig('REPORT_WEBHOOK', ''),

    // ═══════════════════════════════════════════════════════════
    // 👑 ADMIN & CO-OWNER SETTINGS
    // ═══════════════════════════════════════════════════════════
    adminNumbers: parseArray(getConfig('ADMIN_NUMBERS', '')),
    coOwnerNumbers: parseArray(getConfig('CO_OWNER_NUMBERS', '')),
    vipNumbers: parseArray(getConfig('VIP_NUMBERS', '')),

    // ═══════════════════════════════════════════════════════════
    // 🔄 AUTO-UPDATE SYSTEM
    // ═══════════════════════════════════════════════════════════
    autoUpdate: {
        enabled: getConfig('AUTO_UPDATE_ENABLED', "true") === "true",
        checkInterval: parseInt(getConfig('AUTO_UPDATE_INTERVAL', "3600000")), // 1 hour
        autoRestart: getConfig('AUTO_UPDATE_RESTART', "true") === "true",
        notifyOnUpdate: getConfig('AUTO_UPDATE_NOTIFY', "true") === "true",
        githubRepo: getConfig('GITHUB_REPO', "stanytz/insidious"),
        branch: getConfig('GITHUB_BRANCH', "main")
    },

    // ═══════════════════════════════════════════════════════════
    // 📊 ANALYTICS & LOGGING
    // ═══════════════════════════════════════════════════════════
    enableAnalytics: getConfig('ENABLE_ANALYTICS', "true") === "true",
    logLevel: getConfig('LOG_LEVEL', "info"), // debug, info, warn, error
    logToFile: getConfig('LOG_TO_FILE', "true") === "true",
    logFilePath: getConfig('LOG_FILE_PATH', "./logs/bot.log"),

    // ═══════════════════════════════════════════════════════════
    // 🎨 CUSTOMIZATION
    // ═══════════════════════════════════════════════════════════
    footer: getConfig('FOOTER', "© 2025-2026 INSIDIOUS V2.2 | Developer: STANYTZ"),
    watermark: getConfig('WATERMARK', "INSIDIOUS BOT"),
    packname: getConfig('PACKNAME', "INSIDIOUS"),
    author: getConfig('AUTHOR', "STANYTZ"),

    // ═══════════════════════════════════════════════════════════
    // 🔧 ADVANCED SETTINGS
    // ═══════════════════════════════════════════════════════════
    sessionName: getConfig('SESSION_NAME', "session"),
    tmpDir: getConfig('TMP_DIR', "./tmp"),
    downloadDir: getConfig('DOWNLOAD_DIR', "./downloads"),
    backupInterval: parseInt(getConfig('BACKUP_INTERVAL', "86400000")), // 24 hours
    maxConcurrentDownloads: parseInt(getConfig('MAX_CONCURRENT_DOWNLOADS', "5")),
    requestTimeout: parseInt(getConfig('REQUEST_TIMEOUT', "30000")), // 30 seconds
    retryLimit: parseInt(getConfig('RETRY_LIMIT', "3")),

    // ═══════════════════════════════════════════════════════════
    // 🎯 FEATURE FLAGS
    // ═══════════════════════════════════════════════════════════
    enableMenu1: getConfig('ENABLE_MENU1', "true") === "true",
    enableMenu2: getConfig('ENABLE_MENU2', "true") === "true",
    enableMenu3: getConfig('ENABLE_MENU3', "true") === "true",
    enableSearch: getConfig('ENABLE_SEARCH', "true") === "true",
    enableHelp: getConfig('ENABLE_HELP', "true") === "true",
    enableStats: getConfig('ENABLE_STATS', "true") === "true",
    enableOwner: getConfig('ENABLE_OWNER', "true") === "true",
    enableGroup: getConfig('ENABLE_GROUP', "true") === "true",
    enableAdmin: getConfig('ENABLE_ADMIN', "true") === "true",
    enableUtility: getConfig('ENABLE_UTILITY', "true") === "true",

    // ═══════════════════════════════════════════════════════════
    // 📱 MESSAGE TEMPLATES
    // ═══════════════════════════════════════════════════════════
    welcomeMessage: getConfig('WELCOME_MESSAGE', "Welcome @user to the group! 🎉\n\nRead group rules and enjoy your stay."),
    goodbyeMessage: getConfig('GOODBYE_MESSAGE', "Goodbye @user 👋\n\nWe'll miss you!"),
    promoteMessage: getConfig('PROMOTE_MESSAGE', "🎉 Congratulations @user!\n\nYou've been promoted to admin."),
    demoteMessage: getConfig('DEMOTE_MESSAGE', "⚠️ @user\n\nYou've been demoted from admin."),

    // ═══════════════════════════════════════════════════════════
    // 🔐 ENCRYPTION & PRIVACY
    // ═══════════════════════════════════════════════════════════
    encryptDatabase: getConfig('ENCRYPT_DATABASE', "false") === "true",
    encryptionKey: getConfig('ENCRYPTION_KEY', ''),
    enablePrivacyMode: getConfig('PRIVACY_MODE', "false") === "true",
    hideOnlineStatus: getConfig('HIDE_ONLINE', "false") === "true",
    disableReadReceipts: getConfig('DISABLE_READ_RECEIPTS', "false") === "true",

    // ═══════════════════════════════════════════════════════════
    // 🎪 MISCELLANEOUS
    // ═══════════════════════════════════════════════════════════
    enableNsfw: getConfig('ENABLE_NSFW', "false") === "true",
    enableEconomy: getConfig('ENABLE_ECONOMY', "false") === "true",
    enableGames: getConfig('ENABLE_GAMES', "true") === "true",
    enableDownloader: getConfig('ENABLE_DOWNLOADER', "true") === "true",
    enableConverter: getConfig('ENABLE_CONVERTER', "true") === "true",
    enableSearch: getConfig('ENABLE_SEARCH', "true") === "true",
    enableTools: getConfig('ENABLE_TOOLS', "true") === "true",

    // ═══════════════════════════════════════════════════════════
    // 💰 MONETIZATION (Optional)
    // ═══════════════════════════════════════════════════════════
    enablePremium: getConfig('ENABLE_PREMIUM', "false") === "true",
    premiumPrice: getConfig('PREMIUM_PRICE', "5"), // USD per month
    paymentMethods: parseArray(getConfig('PAYMENT_METHODS', 'mpesa,paypal,crypto')),
    mpesaNumber: getConfig('MPESA_NUMBER', ""),
    paypalUrl: getConfig('PAYPAL_URL', ""),
    cryptoWallet: getConfig('CRYPTO_WALLET', ""),

    // ═══════════════════════════════════════════════════════════
    // 🧪 TESTING & DEBUG
    // ═══════════════════════════════════════════════════════════
    debugMode: getConfig('DEBUG_MODE', "false") === "true",
    testMode: getConfig('TEST_MODE', "false") === "true",
    enableProfiling: getConfig('ENABLE_PROFILING', "false") === "true"
};

// ═══════════════════════════════════════════════════════════
// 📝 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get owner JID
 */
module.exports.getOwnerJid = function() {
    return `${module.exports.ownerNumber}@s.whatsapp.net`;
};

/**
 * Check if number is owner
 */
module.exports.isOwner = function(jid) {
    const number = jid.replace(/[^0-9]/g, '');
    return number === module.exports.ownerNumber;
};

/**
 * Check if number is admin
 */
module.exports.isAdmin = function(jid) {
    const number = jid.replace(/[^0-9]/g, '');
    return module.exports.adminNumbers.includes(number) || module.exports.isOwner(jid);
};

/**
 * Get full footer with timestamp
 */
module.exports.getFullFooter = function() {
    return `${module.exports.footer}\n🕐 ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' })}`;
};

/**
 * Validate config
 */
module.exports.validate = function() {
    const warnings = [];
    
    if (!module.exports.ownerNumber || module.exports.ownerNumber === "255000000000") {
        warnings.push("⚠️  OWNER_NUMBER not set! Using default.");
    }
    
    if (!module.exports.mongodb || module.exports.mongodb.includes("sila_md")) {
        warnings.push("⚠️  MONGODB_URI using default. Change to your own!");
    }
    
    if (!module.exports.weatherApiKey) {
        warnings.push("💡  WEATHER_API_KEY not set. Weather command may not work.");
    }
    
    if (warnings.length > 0) {
        console.log("\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮");
        console.log("   ⚠️  CONFIGURATION WARNINGS");
        console.log("╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n");
        warnings.forEach(w => console.log(w));
        console.log("\n");
    }
    
    return warnings.length === 0;
};

// Auto-validate on load
if (process.env.NODE_ENV !== 'production') {
    module.exports.validate();
}

