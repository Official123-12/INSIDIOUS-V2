const fs = require('fs');
const path = require('path');

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
    // BOT METADATA - UPDATED
    // ============================================
    botName: getConfig('BOT_NAME', "ɪɴꜱɪᴅɪᴏᴜꜱ"),
    developerName: getConfig('DEVELOPER_NAME', "STANY"),
    ownerName: getConfig('BOT_OWNER', "STANY"),
    ownerNumber: [getConfig('OWNER_NUMBER', "255000000000")],
    version: "2.1.1",
    year: "2025",
    updated: "2026",
    specialThanks: "ʀᴇᴅᴛᴇᴄʜ",

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
    antilink: true,
    antiporn: true,
    antiscam: true,
    antimedia: false,
    antitag: true,
    antispam: true,
    antibug: true,
    anticall: true,

    // ============================================
    // RECOVERY FEATURES - UPDATED
    // ============================================
    antiviewonce: true,
    antidelete: true,

    // ============================================
    // SLEEPING MODE
    // ============================================
    sleepStart: getConfig('SLEEP_START', "22:00"),
    sleepEnd: getConfig('SLEEP_END', "06:00"),
    sleepingMode: false,

    // ============================================
    // WELCOME/GOODBYE SETTINGS
    // ============================================
    welcomeGoodbye: true,

    // ============================================
    // AUTOBLOCK COUNTRIES
    // ============================================
    blockedCountries: ['92', '212', '234'],

    // ============================================
    // AUTOMATION SETTINGS
    // ============================================
    autoRead: true,
    autoReact: true,
    autoSave: true,
    autoBio: true,
    autoTyping: true,

    // ============================================
    // STATUS AUTO INTERACTION
    // ============================================
    autoStatus: true,
    autoStatusView: true,
    autoStatusLike: true,
    autoStatusReply: true,

    // ============================================
    // AI CHATBOT - POLLINATIONS
    // ============================================
    chatbot: true,
    aiModel: "https://text.pollinations.ai/",
    
    // ============================================
    // DOWNLOADERS
    // ============================================
    darlynApi: "https://api.darlyn.my.id/api/",
    
    // ============================================
    // SCAM KEYWORDS
    // ============================================
    scamKeywords: [
        'investment', 'bitcoin', 'crypto', 'ashinde', 'zawadi', 
        'gift card', 'telegram.me', 'pata pesa', 'ajira'
    ],

    // ============================================
    // PORNO KEYWORDS
    // ============================================
    pornKeywords: [
        'porn', 'sex', 'xxx', 'ngono', 'video za kikubwa', 
        'hentai', 'malaya', 'pussy', 'dick'
    ],

    // ============================================
    // VISUALS
    // ============================================
    menuImage: getConfig('MENU_IMAGE', "https://files.catbox.moe/irqrap.jpg"),
    footer: getConfig('FOOTER', "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1 | Developer: STANY"),
    
    // ============================================
    // DEPLOYMENT SETTINGS
    // ============================================
    port: parseInt(getConfig('PORT', 3000)),
    host: getConfig('HOST', "0.0.0.0"),
    nodeEnv: getConfig('NODE_ENV', "development"),
    
    // ============================================
    // CHANNEL & SUBSCRIPTION SETTINGS
    // ============================================
    channelReactions: ["❤️", "🔥", "⭐", "👍", "🎉"],
    channelSubscription: true,
    autoReactChannel: true,
    
    // ============================================
    // NEW FEATURES
    // ============================================
    sendWelcomeToOwner: true,
    activeMembers: false,
    autoblockCountry: false,
    downloadStatus: false,
    
    // ============================================
    // ADMIN NUMBERS
    // ============================================
    adminNumbers: []
};
