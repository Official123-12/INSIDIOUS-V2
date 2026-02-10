// config.js
const fs = require('fs');
const { fancy } = require('./lib/font');

// Helper to get config
function getConfig(key, defaultValue) {
    if (process.env[key]) return process.env[key];
    return defaultValue;
}

module.exports = {
    // ============================================
    // BOT METADATA
    // ============================================
    botName: getConfig('BOT_NAME', "ɪɴꜱɪᴅɪᴏᴜꜱ"),
    developerName: getConfig('DEVELOPER_NAME', "STANY"),
    ownerNumber: [getConfig('OWNER_NUMBER', "255000000000")],
    version: "2.0",
    
    // ============================================
    // COMMAND SETTINGS
    // ============================================
    prefix: getConfig('BOT_PREFIX', "."),
    
    // ============================================
    // DATABASE
    // ============================================
    mongodbUri: getConfig('MONGODB_URI', "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority"),
    sessionName: getConfig('SESSION_NAME', "insidious_session"),

    // ============================================
    // CHANNEL SETTINGS
    // ============================================
    newsletterJid: getConfig('NEWSLETTER_JID', ""),
    
    // ============================================
    // FEATURES
    // ============================================
    autoBio: true,
    welcomeGoodbye: true,
    anticall: false,
    chatbot: true,
    autoRead: true,
    autoReact: true,
    autoSave: true,
    autoTyping: true,
    
    // ============================================
    // VISUALS & FOOTER
    // ============================================
    footer: "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ | Developer: STANY",
    
    // ============================================
    // DEPLOYMENT
    // ============================================
    port: parseInt(getConfig('PORT', 3000)),
    host: getConfig('HOST', "0.0.0.0")
};
