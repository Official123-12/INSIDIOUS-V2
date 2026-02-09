const fs = require('fs');
const { fancy } = require('./lib/font');
require('dotenv').config(); // Add this for deployment

module.exports = {
    // ============================================
    // BOT METADATA
    // ============================================
    botName: process.env.BOT_NAME || "ɪɴꜱɪᴅɪᴏᴜꜱ: ᴛʜᴇ ʟᴀꜱᴛ ᴋᴇʏ",
    ownerName: process.env.BOT_OWNER || "ꜱᴛᴀɴʏᴛᴢ",
    ownerNumber: process.env.OWNER_NUMBER ? [process.env.OWNER_NUMBER] : ["255618558502"], // Array for multiple owners
    version: process.env.BOT_VERSION || "2.1.1",
    year: "2025",
    updated: "2026",
    specialThanks: "ʀᴇᴅᴛᴇᴄʜ",

    // ============================================
    // COMMAND SETTINGS
    // ============================================
    prefix: process.env.BOT_PREFIX || ".",
    workMode: process.env.BOT_MODE || "public",

    // ============================================
    // NEWSLETTER & CHANNEL SETTINGS
    // ============================================
    newsletterJid: process.env.NEWSLETTER_JID || "120363404317544295@newsletter",
    groupJid: process.env.GROUP_JID || "120363406549688641@g.us",
    channelLink: process.env.CHANNEL_LINK || "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
    channelReactions: process.env.CHANNEL_REACTIONS ? 
        process.env.CHANNEL_REACTIONS.split(',') : ["❤️", "🔥", "⭐"],

    // ============================================
    // DATABASE & SESSION
    // ============================================
    mongodbUri: process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious",
    sessionName: process.env.SESSION_NAME || "insidious_session",

    // ============================================
    // SECURITY FEATURES (Boolean)
    // ============================================
    antilink: process.env.ANTILINK_ENABLED === "true" || true,
    antiporn: process.env.ANTIPORN_ENABLED === "true" || true,
    antiscam: process.env.ANTISCAM_ENABLED === "true" || true,
    antitag: process.env.ANTITAG_ENABLED === "true" || true,
    antispam: process.env.ANTISPAM_ENABLED === "true" || true,
    antibug: process.env.ANTIBUG_ENABLED === "true" || true,
    anticall: process.env.ANTICALL_ENABLED === "true" || true,

    // ============================================
    // RECOVERY FEATURES
    // ============================================
    antiviewonce: process.env.ANTIVIEWONCE_ENABLED === "true" || true,
    antidelete: process.env.ANTIDELETE_ENABLED === "true" || true,

    // ============================================
    // ANTI-MEDIA SETTINGS (String)
    // ============================================
    antimedia: process.env.ANTIMEDIA_MODE || "off", // 'all', 'photo', 'video', 'sticker', 'audio', 'document', 'off'

    // ============================================
    // SLEEP MODE
    // ============================================
    sleepStart: process.env.SLEEP_START || "22:00",
    sleepEnd: process.env.SLEEP_END || "06:00",

    // ============================================
    // AUTO-BLOCK COUNTRIES
    // ============================================
    autoblock: process.env.AUTOBLOCK_COUNTRIES ? 
        process.env.AUTOBLOCK_COUNTRIES.split(',') : ['92', '212', '234'],

    // ============================================
    // AUTOMATION SETTINGS
    // ============================================
    autoStatus: {
        view: process.env.AUTO_STATUS_VIEW === "true" || true,
        like: process.env.AUTO_STATUS_LIKE === "true" || true,
        reply: process.env.AUTO_STATUS_REPLY === "true" || true,
        emoji: process.env.AUTO_STATUS_EMOJI || "🥀"
    },
    autoRead: process.env.AUTO_READ === "true" || true,
    autoReact: process.env.AUTO_REACT === "true" || true,
    autoSave: process.env.AUTO_SAVE === "true" || true,
    autoBio: process.env.AUTO_BIO === "true" || true,
    autoTyping: process.env.AUTO_TYPING === "true" || true,

    // ============================================
    // AI CONFIGURATION
    // ============================================
    aiModel: process.env.AI_API_URL || "https://gpt.aliali.dev/api/v1?text=",
    // Alternative: "https://text.pollinations.ai/",
    
    // ============================================
    // DOWNLOADER APIS
    // ============================================
    darlynApi: process.env.DARLYN_API || "https://api.darlyn.my.id/api/",
    
    // ============================================
    // MEDIA & VISUALS
    // ============================================
    menuImage: process.env.MENU_IMAGE || "https://files.catbox.moe/irqrap.jpg",
    footer: process.env.BOT_FOOTER || "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1 ʙʏ ꜱᴛᴀɴʏᴛᴢ",

    // ============================================
    // KEYWORD LISTS (For security)
    // ============================================
    scamWords: process.env.SCAM_WORDS ? 
        process.env.SCAM_WORDS.split(',') : [
            'investment', 'bitcoin', 'crypto', 'ashinde', 'zawadi', 
            'gift card', 'telegram.me', 'pata pesa', 'ajira'
        ],

    pornWords: process.env.PORN_WORDS ? 
        process.env.PORN_WORDS.split(',') : [
            'porn', 'sex', 'xxx', 'ngono', 'video za kikubwa', 
            'hentai', 'malaya', 'pussy', 'dick'
        ],

    // ============================================
    // DEPLOYMENT SETTINGS
    // ============================================
    port: process.env.PORT || 3000,
    host: process.env.HOST || "0.0.0.0",
    nodeEnv: process.env.NODE_ENV || "development",
    
    // ============================================
    // ADDITIONAL SETTINGS FOR HANDLER
    // ============================================
    // For channel subscription feature
    channelSubscription: process.env.CHANNEL_SUBSCRIPTION === "true" || true,
    autoReactChannel: process.env.AUTO_REACT_CHANNEL === "true" || true,
    
    // For chatbot
    chatbot: process.env.CHATBOT_ENABLED === "true" || true,
    
    // Admin numbers (optional)
    adminNumbers: process.env.ADMIN_NUMBERS ? 
        process.env.ADMIN_NUMBERS.split(',') : [],

    // ============================================
    // LOGGING
    // ============================================
    debug: process.env.DEBUG === "true" || false,
    
    // ============================================
    // RATE LIMITING
    // ============================================
    rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_MAX) || 10,
        window: parseInt(process.env.RATE_LIMIT_WINDOW) || 60 // seconds
    }
};
