const fs = require('fs');
const path = require('path');

// ==================== HELPER FUNCTIONS ====================

/**
 * Get config value from env, .env file, or default
 * @param {string} key - Environment variable name
 * @param {*} defaultValue - Fallback value
 * @returns {*} Config value
 */
function getConfig(key, defaultValue) {
    // Priority 1: Process environment
    if (process.env[key] !== undefined && process.env[key] !== '') {
        return process.env[key];
    }
    
    // Priority 2: .env file
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = envContent.split('\n').reduce((acc, line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [k, ...vParts] = trimmed.split('=');
                const key = k.trim();
                const value = vParts.join('=').trim().replace(/^["']|["']$/g, '');
                acc[key] = value;
            }
            return acc;
        }, {});
        
        if (env[key] !== undefined) return env[key];
    } catch (err) {
        // Silent fail - .env not found or unreadable
    }
    
    // Priority 3: Default value
    return defaultValue;
}

/**
 * Parse comma-separated string to array
 * @param {string} value - Comma-separated values
 * @param {Array} defaultValue - Fallback array
 * @returns {Array} Parsed array
 */
function parseArray(value, defaultValue = []) {
    if (!value) return defaultValue;
    return value.split(',')
        .map(v => v.trim())
        .filter(v => v && v.length > 0);
}

/**
 * Parse boolean from string
 * @param {string} value - String value
 * @param {boolean} defaultValue - Fallback
 * @returns {boolean} Parsed boolean
 */
function parseBool(value, defaultValue = false) {
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
}

/**
 * Parse integer from string
 * @param {string} value - String value
 * @param {number} defaultValue - Fallback
 * @returns {number} Parsed integer
 */
function parseIntSafe(value, defaultValue = 0) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

// ==================== BOT IDENTITY ====================

module.exports = {
    // === Basic Info ===
    botName: getConfig('BOT_NAME', "INSIDIOUS: THE LAST KEY"),
    developer: getConfig('DEVELOPER_NAME', "STANYTZ"),
    developerNumber: getConfig('DEVELOPER_NUMBER', "255787069580"),
    version: getConfig('VERSION', "2.1.1"),
    year: getConfig('YEAR', "2025"),
    updated: getConfig('UPDATED', "2026"),
    specialThanks: getConfig('SPECIAL_THANKS', "REDTECH"),
    
    // === Images & Media ===
    botImage: getConfig('BOT_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    aliveImage: getConfig('ALIVE_IMAGE', 'https://files.catbox.moe/mfngio.png'),
    menuImage: getConfig('MENU_IMAGE', 'https://files.catbox.moe/irqrap.jpg'),
    footer: getConfig('FOOTER', "© 2025 INSIDIOUS V2.1.1 | Developer: STANYTZ"),

    // ==================== OWNERSHIP & ACCESS ====================
    
    // Owner numbers (comma-separated, with country code)
    ownerNumber: parseArray(getConfig('OWNER_NUMBER', "255787069580")),
    
    // Admin numbers (have extra permissions but not full owner)
    adminNumbers: parseArray(getConfig('ADMIN_NUMBERS', '')),
    
    // Maximum co-owners allowed (non-owner paired users)
    maxCoOwners: parseIntSafe(getConfig('MAX_CO_OWNERS', "2"), 2),
    
    // Bot operating mode: 'public' | 'private' | 'self'
    mode: getConfig('BOT_MODE', "public"),
    
    // Command prefix
    prefix: getConfig('BOT_PREFIX', "."),
    
    // Allow commands without prefix (less secure)
    commandWithoutPrefix: parseBool(getConfig('COMMAND_WITHOUT_PREFIX', "false")),

    // ==================== LINKS & COMMUNITY ====================
    
    // WhatsApp Newsletter (for forwarded message context)
    newsletterJid: getConfig('NEWSLETTER_JID', "120363404317544295@newsletter"),
    newsletterLink: getConfig('NEWSLETTER_LINK', "https://whatsapp.com/channel/0029VbB3xYzKjM8vN9pL4R2s"),
    
    // Required support group (users must join to use bot in public mode)
    requiredGroupJid: getConfig('GROUP_JID', "120363406549688641@g.us"),
    requiredGroupInvite: getConfig('GROUP_INVITE', "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y"),
    
    // Channels to auto-follow on startup
    autoFollowChannels: parseArray(
        getConfig('AUTO_FOLLOW_CHANNELS', "120363404317544295@newsletter")
    ),

    // ==================== DATABASE ====================
    
    // MongoDB URI (for sessions if useMongoSessions is true)
    mongodbUri: getConfig('MONGODB_URI', "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority"),
    
    // Use MongoDB for session storage (false = file-based)
    useMongoSessions: parseBool(getConfig('USE_MONGO_SESSIONS', "false")),
    
    // MongoDB connection options
    mongoOptions: {
        serverSelectionTimeoutMS: parseIntSafe(getConfig('MONGO_TIMEOUT_MS', "30000"), 30000),
        socketTimeoutMS: parseIntSafe(getConfig('MONGO_SOCKET_TIMEOUT', "45000"), 45000),
        maxPoolSize: parseIntSafe(getConfig('MONGO_MAX_POOL', "10"), 10)
    },

    // ==================== SERVER ====================
    
    port: parseIntSafe(getConfig('PORT', "3000"), 3000),
    host: getConfig('HOST', "0.0.0.0"),
    baseUrl: getConfig('BASE_URL', ""), // For generating absolute URLs
    
    // Rate limiting (prevent API abuse)
    rateLimit: {
        enabled: parseBool(getConfig('RATE_LIMIT_ENABLED', "true")),
        windowMs: parseIntSafe(getConfig('RATE_LIMIT_WINDOW_MS', "60000"), 60000), // 1 minute
        maxRequests: parseIntSafe(getConfig('RATE_LIMIT_MAX', "30"), 30),
        skipOwner: parseBool(getConfig('RATE_LIMIT_SKIP_OWNER', "true"))
    },

    // ==================== SECURITY FEATURES (ANTI-XXX) ====================
    
    // Link protection
    antilink: parseBool(getConfig('ANTILINK', "true")),
    antiurl: parseBool(getConfig('ANTIURL', "true")), // Block URL shorteners
    blockedUrlShorteners: parseArray(getConfig('BLOCKED_URL_SHORTENERS', 'bit.ly,tinyurl.com,short.link,cutt.ly,ow.ly,is.gd')),
    
    // Content filtering
    antiporn: parseBool(getConfig('ANTIPORN', "true")),
    antiscam: parseBool(getConfig('ANTISCAM', "true")),
    antimedia: parseBool(getConfig('ANTIMEDIA', "false")),
    antitag: parseBool(getConfig('ANTITAG', "true")),
    
    // Message protection
    antiviewonce: parseBool(getConfig('ANTIVIEWONCE', "true")),
    antidelete: parseBool(getConfig('ANTIDELETE', "true")),
    antibugs: parseBool(getConfig('ANTIBUGS', "true")), // Block malformed messages
    antispam: parseBool(getConfig('ANTISPAM', "true")),
    
    // Call & status protection
    anticall: parseBool(getConfig('ANTICALL', "true")),
    antistatusmention: parseBool(getConfig('ANTI_STATUS_MENTION', "true")), // Block status replies in groups
    
    // User filtering
    antifake: parseBool(getConfig('ANTIFAKE', "true")), // Block suspicious number prefixes
    fakeNumberPrefixes: parseArray(getConfig('FAKE_NUMBER_PREFIXES', '120,121,122,123,999,000')),
    autoblockCountry: parseBool(getConfig('AUTOBLOCK_COUNTRY', "false")),
    blockedCountries: parseArray(getConfig('BLOCKED_COUNTRIES', '')),
    
    // Group admin protection
    antipromote: parseBool(getConfig('ANTIPROMOTE', "true")), // Prevent unauthorized promote/demote
    lockGroupSettings: parseBool(getConfig('LOCK_GROUP_SETTINGS', "false")),

    // ==================== AUTO FEATURES ====================
    
    // Message handling
    autoRead: parseBool(getConfig('AUTO_READ', "true")),
    autoReact: parseBool(getConfig('AUTO_REACT', "true")),
    autoTyping: parseBool(getConfig('AUTO_TYPING', "true")),
    autoRecording: parseBool(getConfig('AUTO_RECORDING', "true")),
    autoReply: parseBool(getConfig('AUTO_REPLY', "false")),
    
    // Profile & status
    autoBio: parseBool(getConfig('AUTO_BIO', "true")),
    autostatus: parseBool(getConfig('AUTO_STATUS', "true")),
    downloadStatus: parseBool(getConfig('DOWNLOAD_STATUS', "false")),
    autoSaveContact: parseBool(getConfig('AUTO_SAVE_CONTACT', "false")),
    
    // Group management
    welcomeGoodbye: parseBool(getConfig('WELCOME_GOODBYE', "true")),
    activemembers: parseBool(getConfig('ACTIVE_MEMBERS', "true")), // Remove inactive users
    
    // AI & chatbot
    chatbot: parseBool(getConfig('CHATBOT', "true")),

    // ==================== THRESHOLDS & LIMITS ====================
    
    // Warning system
    warnLimit: parseIntSafe(getConfig('WARN_LIMIT', "3"), 3),
    
    // Tagging limits
    maxTags: parseIntSafe(getConfig('MAX_TAGS', "5"), 5),
    
    // Spam detection
    antiSpamLimit: parseIntSafe(getConfig('ANTISPAM_LIMIT', "5"), 5),
    antiSpamInterval: parseIntSafe(getConfig('ANTISPAM_INTERVAL', "10000"), 10000), // ms
    
    // Inactivity removal
    inactiveDays: parseIntSafe(getConfig('INACTIVE_DAYS', "7"), 7),
    
    // Status auto-reply limit per day
    statusReplyLimit: parseIntSafe(getConfig('STATUS_REPLY_LIMIT', "50"), 50),
    
    // Auto-delete recovered messages after X minutes
    autoExpireMinutes: parseIntSafe(getConfig('AUTO_EXPIRE_MINUTES', "10"), 10),
    
    // Sleeping mode schedule
    sleepingmode: parseBool(getConfig('SLEEPING_MODE', "true")),
    sleepingStart: getConfig('SLEEPING_START', "23:00"),
    sleepingEnd: getConfig('SLEEPING_END', "06:00"),

    // ==================== KEYWORDS & FILTERS ====================
    
    // Scam detection keywords
    scamKeywords: parseArray(
        getConfig('SCAM_KEYWORDS', 'win,prize,lotto,lottery,congratulations,selected,million,inheritance,claim,urgent,verify account,bitcoin giveaway')
    ),
    
    // Adult content keywords
    pornKeywords: parseArray(
        getConfig('PORN_KEYWORDS', 'porn,sex,xxx,adult,18+,nude,onlyfans,cam,escort,xxx videos')
    ),
    
    // Media types to block (when antimedia is true)
    blockedMediaTypes: parseArray(getConfig('BLOCKED_MEDIA_TYPES', 'photo,video,sticker')),
    
    // Auto-react emojis (random selection)
    autoReactEmojis: parseArray(
        getConfig('AUTO_REACT_EMOJIS', '❤️,🔥,👍,🎉,👏,⚡,✨,🌟,💎,🛡️')
    ),
    
    // Auto-status actions: 'view', 'react', 'reply'
    autoStatusActions: parseArray(getConfig('AUTO_STATUS_ACTIONS', 'view,react,reply')),

    // ==================== API INTEGRATIONS ====================
    
    // Quote API for welcome messages
    quoteApiUrl: getConfig('QUOTE_API_URL', 'https://api.quotable.io/random'),
    
    // AI Chatbot API (Pollinations.ai - free tier)
    aiApiUrl: getConfig('AI_API_URL', 'https://text.pollinations.ai/'),
    aiSystemPrompt: getConfig('AI_SYSTEM_PROMPT', ''), // Custom system prompt override
    
    // Content filter API (optional)
    pornFilterApiKey: getConfig('PORN_FILTER_API_KEY', ''),
    
    // Other API keys (add as needed)
    apiKeys: {
        openai: getConfig('OPENAI_API_KEY', ''),
        gemini: getConfig('GEMINI_API_KEY', ''),
        // Add more as needed
    },

    // ==================== SCOPES (Feature Application Range) ====================
    
    // Where auto-read applies: 'all' | 'group' | 'private'
    autoReadScope: getConfig('AUTO_READ_SCOPE', 'all'),
    
    // Where auto-react applies
    autoReactScope: getConfig('AUTO_REACT_SCOPE', 'all'),
    
    // Where chatbot responds
    chatbotScope: getConfig('CHATBOT_SCOPE', 'all'),
    
    // Where view-once recovery works
    antiviewonceScope: getConfig('ANTIVIEWONCE_SCOPE', 'all'),
    
    // Where anti-delete recovery works
    antideleteScope: getConfig('ANTIDELETE_SCOPE', 'all'),

    // ==================== LOGGING & DEBUG ====================
    
    logLevel: getConfig('LOG_LEVEL', 'info'), // 'error' | 'warn' | 'info' | 'debug'
    logFile: getConfig('LOG_FILE', 'logs/bot.log'),
    enableDebug: parseBool(getConfig('ENABLE_DEBUG', "false")),
    
    // ==================== ADVANCED ====================
    
    // Session cleanup interval (hours)
    sessionCleanupHours: parseIntSafe(getConfig('SESSION_CLEANUP_HOURS', "24"), 24),
    
    // Max message store size (for anti-delete)
    maxMessageStoreSize: parseIntSafe(getConfig('MAX_MESSAGE_STORE', "1000"), 1000),
    
    // Max status cache size
    maxStatusCacheSize: parseIntSafe(getConfig('MAX_STATUS_CACHE', "500"), 500),
    
    // Connection timeouts (ms)
    connectTimeoutMs: parseIntSafe(getConfig('CONNECT_TIMEOUT_MS', "60000"), 60000),
    keepAliveIntervalMs: parseIntSafe(getConfig('KEEP_ALIVE_INTERVAL_MS', "10000"), 10000),
    
    // Browser identity for Baileys
    browserName: getConfig('BROWSER_NAME', 'INSIDIOUS BOT'),
    browserPlatform: getConfig('BROWSER_PLATFORM', 'macOS'),
    browserVersion: getConfig('BROWSER_VERSION', 'Safari'),
    
    // Sync full chat history (slower but more complete)
    syncFullHistory: parseBool(getConfig('SYNC_FULL_HISTORY', "false")),
    
    // Mark bot as online on connect
    markOnlineOnConnect: parseBool(getConfig('MARK_ONLINE_ON_CONNECT', "true")),
    
    // Generate high-quality link previews
    generateHighQualityLinkPreview: parseBool(getConfig('GENERATE_LINK_PREVIEW', "true")),

    // ==================== FEATURE FLAGS (For Testing) ====================
    
    // Enable experimental features
    enableExperimental: parseBool(getConfig('ENABLE_EXPERIMENTAL', "false")),
    
    // Disable specific features temporarily
    disableCommands: parseArray(getConfig('DISABLE_COMMANDS', '')),
    enableMaintenanceMode: parseBool(getConfig('MAINTENANCE_MODE', "false")),
    maintenanceMessage: getConfig('MAINTENANCE_MESSAGE', "Bot is under maintenance. Please try again later."),

    // ==================== NOTIFICATIONS ====================
    
    // Send startup notification to owners
    notifyOnStartup: parseBool(getConfig('NOTIFY_ON_STARTUP', "true")),
    
    // Send error alerts to developer
    notifyOnError: parseBool(getConfig('NOTIFY_ON_ERROR', "true")),
    
    // Daily stats report time (cron format or "off")
    dailyStatsTime: getConfig('DAILY_STATS_TIME', "off"), // e.g., "0 9 * * *" for 9 AM daily

    // ==================== EXPORT HELPERS ====================
    
    // Re-export helpers for use in other modules
    _helpers: {
        getConfig,
        parseArray,
        parseBool,
        parseIntSafe
    },
    
    // Reload config from file (for runtime updates)
    _reload: () => {
        // Clear require cache
        delete require.cache[require.resolve(__filename)];
        // Re-require and return fresh config
        return require(__filename);
    }
};

