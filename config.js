const fs = require('fs');

// Load .env file manually
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

// Helper to get config with fallbacks
function getConfig(key, defaultValue) {
    if (process.env[key]) return process.env[key];
    if (envConfig[key]) return envConfig[key];
    return defaultValue;
}

module.exports = {
    // ============================================
    // BOT METADATA
    // ============================================
    botName: getConfig('BOT_NAME', "INSIDIOUS"),
    developerName: getConfig('DEVELOPER_NAME', "STANYTZ"),
    ownerName: getConfig('BOT_OWNER', "STANY"),
    ownerNumber: getConfig('OWNER_NUMBER', "255000000000").split(','),
    version: "2.1.1",
    year: "2025",
    updated: "2026",
    specialThanks: "REDTECH",

    // ============================================
    // COMMAND SETTINGS
    // ============================================
    prefix: getConfig('BOT_PREFIX', "."),
    workMode: getConfig('BOT_MODE', "public"),

    // ============================================
    // NEWSLETTER & GROUP BRANDING
    // ============================================
    newsletterJid: getConfig('NEWSLETTER_JID', "120363404317544295@newsletter"),
    groupJid: getConfig('GROUP_JID', "120363406549688641@g.us"),
    channelLink: getConfig('CHANNEL_LINK', "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y"),
    
    // ============================================
    // DATABASE
    // ============================================
    mongodb: getConfig('MONGODB_URI', "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious"),
    sessionName: getConfig('SESSION_NAME', "insidious_session"),

    // ============================================
    // ANTI FEATURES - ALL TRUE BY DEFAULT
    // ============================================
    antilink: getConfig('ANTILINK', "true") === "true",
    antiporn: getConfig('ANTIPORN', "true") === "true",
    antiscam: getConfig('ANTISCAM', "true") === "true",
    antimedia: getConfig('ANTIMEDIA', "false") === "true",
    antitag: getConfig('ANTITAG', "true") === "true",
    antispam: getConfig('ANTISPAM', "true") === "true",
    antibug: getConfig('ANTIBUG', "true") === "true",
    anticall: getConfig('ANTICALL', "true") === "true",

    // ============================================
    // RECOVERY FEATURES
    // ============================================
    antiviewonce: getConfig('ANTIVIEWONCE', "true") === "true",
    antidelete: getConfig('ANTIDELETE', "true") === "true",

    // ============================================
    // SLEEPING MODE
    // ============================================
    sleepStart: getConfig('SLEEP_START', "22:00"),
    sleepEnd: getConfig('SLEEP_END', "06:00"),
    sleepingMode: getConfig('SLEEPING_MODE', "false") === "true",

    // ============================================
    // WELCOME/GOODBYE SETTINGS
    // ============================================
    welcomeGoodbye: getConfig('WELCOME_GOODBYE', "true") === "true",

    // ============================================
    // AUTOMATION SETTINGS
    // ============================================
    autoRead: getConfig('AUTO_READ', "true") === "true",
    autoReact: getConfig('AUTO_REACT', "true") === "true",
    autoSave: getConfig('AUTO_SAVE', "false") === "true",
    autoBio: getConfig('AUTO_BIO', "true") === "true",
    autoTyping: getConfig('AUTO_TYPING', "true") === "true",
    autoRecording: getConfig('AUTO_RECORDING', "true") === "true",

    // ============================================
    // STATUS AUTO INTERACTION
    // ============================================
    autoStatus: getConfig('AUTO_STATUS', "true") === "true",
    autoStatusView: getConfig('AUTO_STATUS_VIEW', "true") === "true",
    autoStatusLike: getConfig('AUTO_STATUS_LIKE', "true") === "true",
    autoStatusReply: getConfig('AUTO_STATUS_REPLY', "true") === "true",

    // ============================================
    // AI CHATBOT
    // ============================================
    chatbot: getConfig('CHATBOT', "true") === "true",
    
    // ============================================
    // DOWNLOADERS
    // ============================================
    darlynApi: "https://api.darlyn.my.id/api/",
    downloadStatus: getConfig('DOWNLOAD_STATUS', "false") === "true",
    
    // ============================================
    // SCAM KEYWORDS
    // ============================================
    scamKeywords: [
        'investment', 'bitcoin', 'crypto', 'ashinde', 'zawadi', 
        'gift card', 'telegram.me', 'pata pesa', 'ajira',
        'pesa haraka', 'mtaji', 'uwekezaji', 'double money',
        'free money', 'won money', 'won prize', 'lottery'
    ],

    // ============================================
    // PORNO KEYWORDS
    // ============================================
    pornKeywords: [
        'porn', 'sex', 'xxx', 'ngono', 'video za kikubwa', 
        'hentai', 'malaya', 'pussy', 'dick', 'fuck',
        'ass', 'boobs', 'nude', 'nudes', 'nsfw'
    ],

    // ============================================
    // VISUALS
    // ============================================
    menuImage: getConfig('MENU_IMAGE', "https://files.catbox.moe/irqrap.jpg"),
    footer: getConfig('FOOTER', "© 2025 INSIDIOUS V2.1.1 | Developer: STANYTZ"),
    
    // ============================================
    // DEPLOYMENT SETTINGS
    // ============================================
    port: parseInt(getConfig('PORT', 3000)),
    host: getConfig('HOST', "0.0.0.0"),
    nodeEnv: getConfig('NODE_ENV', "development"),
    
    // ============================================
    // NEW FEATURES
    // ============================================
    activeMembers: getConfig('ACTIVE_MEMBERS', "false") === "true",
    autoblockCountry: getConfig('AUTOBLOCK_COUNTRY', "false") === "true",
    
    // ============================================
    // ADMIN NUMBERS
    // ============================================
    adminNumbers: getConfig('ADMIN_NUMBERS', '').split(',').filter(n => n),
};
