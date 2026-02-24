/**
 * 🚀 INSIDIOUS NEXUS • FEATURES SHOWCASE
 * 💎 Premium Features List • Bot Capabilities
 * 🇬🇧 English Only • Premium International Standard
 */

const { fancy } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "features",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // ========== 🎯 REAL USERNAME ==========
            const userNumber = sender.split('@')[0];
            let userName = pushname?.trim() || '';
            if (!userName || userName === 'undefined') {
                try {
                    const contact = conn.contactStore?.contacts?.[sender] || await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || contact?.verifiedName || '';
                } catch {}
            }
            userName = userName?.trim() || `User_${userNumber.slice(-4)}`;
            const mentions = [sender];

            // ========== 💎 FEATURES CONTENT ==========
            const featuresBody = `╭━━━━━━━━━━━━━━━━━━╮
   💎 PREMIUM FEATURES
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName} (@${userNumber})

┌─── 🚀 CORE FEATURES ───
│ ✓ Multi-Device Support
│ ✓ Auto-Read Messages
│ ✓ Anti-Delete Messages
│ ✓ Auto-Reply System
│ ✓ Command Aliases
│ ✓ Custom Prefix
└─────────────────────

┌─── 🎨 MEDIA FEATURES ───
│ ✓ Image Generator
│ ✓ Video Downloader
│ ✓ Audio Converter
│ ✓ Sticker Creator
│ ✓ Meme Generator
│ ✓ QR Code Maker
└─────────────────────

┌─── 🛡️ SECURITY FEATURES ───
│ ✓ Anti-Spam System
│ ✓ Anti-Link Protection
│ ✓ NSFW Filter
│ ✓ Admin Commands
│ ✓ Ban/Unban System
│ ✓ Whitelist Mode
└─────────────────────

┌─── 🎯 UTILITY FEATURES ───
│ ✓ Group Management
│ ✓ User Statistics
│ ✓ Welcome Messages
│ ✓ Leave Messages
│ ✓ Custom Tags
│ ✓ Scheduled Tasks
└─────────────────────

┌─── 🌟 PREMIUM EXCLUSIVE ───
│ ✓ Priority Support
│ ✓ Custom Commands
│ ✓ API Access
│ ✓ Plugin System
│ ✓ Analytics Dashboard
│ ✓ Daily Updates
└─────────────────────

_© 2026 ${config.developerName} Industries_`;

            // ========== 🎨 BUTTONS ==========
            const buttons = [
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `👑 VIP Access`,
                        id: `${config.prefix}vip`
                    })
                },
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `🚀 Nexus`,
                        id: `${config.prefix}menu3`
                    })
                },
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `🏠 Main Menu`,
                        id: `${config.prefix}menu`
                    })
                }
            ];

            // ========== 📲 SEND MESSAGE ==========
            await conn.sendMessage(from, {
                text: fancy(featuresBody),
                contextInfo: {
                    externalAdReply: {
                        title: "ɪɴꜱɪᴅɪᴏᴜꜱ : ᴘʀᴇᴍɪᴜᴍ ғᴇᴀᴛᴜʀᴇꜱ",
                        body: "💎 Unlock Full Potential",
                        mediaType: 1,
                        thumbnailUrl: config.menuImage3,
                        renderLargerThumbnail: true,
                        sourceUrl: config.channelUrl,
                        showAdAttribution: true
                    }
                }
            }, { quoted: msg, mentions });

        } catch (e) {
            console.error("❌ Features Error:", e);
            
            const text = `╭━━━━━━━━━━━━━━━━━━╮\n   💎 FEATURES\n╰━━━━━━━━━━━━━━━━━━╯\n\n🚀 Multi-Device\n🎨 Media Tools\n🛡️ Security\n🎯 Utilities\n\n━━━ 🚀 ━━━\n👑 ${config.developerName}`;
            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
        }
    }
};

