const fs = require('fs');
const { fancy } = require('./lib/font');

module.exports = {
    // 31. BOT METADATA
    botName: "ɪɴꜱɪᴅɪᴏᴜꜱ: ᴛʜᴇ ʟᴀꜱᴛ ᴋᴇʏ",
    ownerName: "ꜱᴛᴀɴʏᴛᴢ",
    ownerNumber: "255618558502", // Weka namba yako bila + hapa
    version: "2.1.1",
    year: "2025",
    updated: "2026",
    specialThanks: "ʀᴇᴅᴛᴇᴄʜ",

    // 22 & 23. COMMAND SETTINGS
    prefix: ".", // Unaweza kubadilisha iwe emoji au alama yoyote
    workMode: "public", // 'public' kwa watu wote, 'private' kwa ajili yako tu

    // 30. NEWSLETTER & GROUP BRANDING
    newsletterJid: "120363404317544295@newsletter",
    groupJid: "120363406549688641@g.us",
    channelLink: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
    
    // 27. DEPLOYMENT & DATABASE (Always Online)
    mongodb: process.env.MONGODB_URL || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/", // Lazima uweke link ya MongoDB Atlas
    sessionName: "session",

    // 1 - 4. ADMIN & SECURITY FEATURES (Set to true to activate)
    antilink: true,      // Usage: Delete, Warn, Remove for links
    antiporn: true,      // Usage: Delete, Warn, Remove for porn content
    antiscam: true,      // Usage: Tag-All Warning & Remove for scams
    antimedia: "off",    // Options: 'photo', 'video', 'sticker', 'all', 'off'
    antitag: true,       // Usage: Prevent mass tagging or @everyone
    antispam: true,      // Usage: Limit messages per minute
    antibug: true,       // Usage: Block bots sending crash codes
    anticall: true,      // 17. Usage: Reject all calls automatically

    // 5 - 6. RECOVERY FEATURES
    antiviewonce: true,  // Usage: Catch ViewOnce and send to Owner DM
    antidelete: true,    // Usage: Catch Deleted messages and send to Owner DM

    // 7. SLEEPING MODE (Automatic Group Close/Open)
    sleepStart: "22:00", // Muda wa kufunga Group (Saa nne usiku)
    sleepEnd: "06:00",   // Muda wa kufungua Group (Saa kumi na mbili asubuhi)

    // 10. AUTOBLOCK (Target Country Codes)
    autoblock: ['92', '212', '234'], // Block Pakistan, Morocco, Nigeria numbers

    // 12 - 14. AUTOMATION
    autoStatus: {
        view: true,      // View all status
        like: true,      // React to status
        reply: true,     // AI reply to status mood
        emoji: "🥀"       // Emoji ya kulike status
    },
    autoRead: true,      // 13. Read all messages
    autoReact: true,     // 14. React to all messages automatically
    autoSave: true,      // 15. Save unknown contacts automatically
    autoBio: true,       // 16. Update Bio with Uptime & Dev Name
    autoTyping: true,    // 32. Show "typing..." when bot is thinking

    // 11. CHATBOT AI (Same Language Logic)
    aiModel: "https://text.pollinations.ai/", // Pollinations AI (Free)
    
    // 28. MEDIA DOWNLOADERS (Free Working APIs)
    darlynApi: "https://api.darlyn.my.id/api/",
    
    // SCAM KEYWORDS (Feature 2)
    scamWords: [
        'investment', 'bitcoin', 'crypto', 'ashinde', 'zawadi', 
        'gift card', 'telegram.me', 'pata pesa', 'ajira'
    ],

    // PORNO KEYWORDS (Feature 2)
    pornWords: [
        'porn', 'sex', 'xxx', 'ngono', 'video za kikubwa', 
        'hentai', 'malaya', 'pussy', 'dick'
    ],

    // VISUALS
    menuImage: "https://files.catbox.moe/insidious-v2-menu.jpg", // Weka link ya picha yako ya bot
    footer: "© 2025 ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ2.1.1 ʙʏ ꜱᴛᴀɴʏᴛᴢ",
};

// Logic ya ku-apply Small Caps kwenye Config (Optional)
console.log(fancy("--- INSIDIOUS V2.1.1 CONFIG LOADED ---"));
