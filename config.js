const fs = require('fs');
const { fancy } = require('./lib/font');

module.exports = {
    // 31. BOT METADATA
    botName: "ɪɴꜱɪᴅɪᴏᴜꜱ: ᴛʜᴇ ʟᴀꜱᴛ ᴋᴇʏ",
    ownerName: "ꜱᴛᴀɴʏᴛᴢ",
    ownerNumber: "255618558502",
    version: "2.1.1",
    year: "2025",
    updated: "2026",
    specialThanks: "ʀᴇᴅᴛᴇᴄʜ",

    // 22 & 23. COMMAND SETTINGS
    prefix: ".",
    workMode: "public",

    // 30. NEWSLETTER & GROUP BRANDING
    newsletterJid: "120363404317544295@newsletter",
    groupJid: "120363406549688641@g.us",
    channelLink: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
    
    // 27. DEPLOYMENT & DATABASE
    mongodb: process.env.MONGODB_URL || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious",
    sessionName: "insidious_session",

    // ANTI FEATURES
    antilink: true,
    antiporn: true,
    antiscam: true,
    antimedia: "off",
    antitag: true,
    antispam: true,
    antibug: true,
    anticall: true,

    // RECOVERY FEATURES
    antiviewonce: true,
    antidelete: true,

    // SLEEPING MODE
    sleepStart: "22:00",
    sleepEnd: "06:00",

    // AUTOBLOCK
    autoblock: ['92', '212', '234'],

    // AUTOMATION
    autoStatus: {
        view: true,
        like: true,
        reply: true,
        emoji: "🥀"
    },
    autoRead: true,
    autoReact: true,
    autoSave: true,
    autoBio: true,
    autoTyping: true,

    // AI
    aiModel: "https://text.pollinations.ai/",
    
    // DOWNLOADERS
    darlynApi: "https://api.darlyn.my.id/api/",
    
    // SCAM KEYWORDS
    scamWords: [
        'investment', 'bitcoin', 'crypto', 'ashinde', 'zawadi', 
        'gift card', 'telegram.me', 'pata pesa', 'ajira'
    ],

    // PORNO KEYWORDS
    pornWords: [
        'porn', 'sex', 'xxx', 'ngono', 'video za kikubwa', 
        'hentai', 'malaya', 'pussy', 'dick'
    ],

    // VISUALS
    menuImage: "https://files.catbox.moe/irqrap.jpg",
    footer: "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1 ʙʏ ꜱᴛᴀɴʏᴛᴢ",
};