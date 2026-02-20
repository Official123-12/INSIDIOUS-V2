module.exports = {
    name: "repo",
    aliases: ["info", "guide", "website"],
    description: "Get bot information, pairing website, and instructions",
    
    execute: async (conn, msg, args, { from, reply }) => {
        try {
            const websiteUrl = 'https://insidiousstanytz.up.railway.app';
            const groupInvite = 'https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y';
            const channelLink = 'https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p';
            const developerNumber = '255787069580';

            const message = `╭─── • 🥀 • ───╮
   INSIDIOUS BOT INFO
╰─── • 🥀 • ───╯

🌐 BOT WEBSITE
${websiteUrl}
➡️ Get your 8-digit pairing code instantly
➡️ Enter your number with country code (e.g., 255XXXXXXXXX)
➡️ Code expires in 60 seconds

📋 HOW TO PAIR:
1. Open WhatsApp → Settings → Linked Devices
2. Tap "Link a Device" → "Link with Phone Number"
3. Enter the 8-digit code from the website
4. Wait for connection

👥 JOIN OUR GROUP
${groupInvite}
➡️ Required to use bot commands (antilink, welcome, etc.)

📢 FOLLOW OUR CHANNEL
${channelLink}
➡️ Get updates on new features

👑 DEVELOPER
${developerNumber}
➡️ For support and inquiries

━━━━━━━━━━━━━━━━━━
DEVELOPED BY STANYTZ © 2025
VERSION 2.1.1`;

            await conn.sendMessage(from, { text: message }, { quoted: msg });

        } catch (error) {
            console.error('REPO command error:', error);
            reply('❌ Failed to display info. Try again later.');
        }
    }
};