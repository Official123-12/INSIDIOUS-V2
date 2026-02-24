/**
 * 🚀 INSIDIOUS • REPORT COMMAND
 * 🐛 Submit bug reports • Feature requests
 * 🇬🇧 English Only • Premium Standard
 */

const { fancy } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "report",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // 🎯 Real username
            const userNumber = sender.split('@')[0];
            let userName = pushname?.trim() || '';
            if (!userName || userName === 'undefined') {
                try {
                    const contact = conn.contactStore?.contacts?.[sender] || await conn.getContact(sender);
                    userName = contact?.name || contact?.pushname || userName;
                } catch {}
            }
            userName = userName?.trim() || `User_${userNumber.slice(-4)}`;

            // 📝 Check if report message provided
            const reportMsg = args.join(' ').trim();
            
            if (!reportMsg) {
                const usageBody = `╭━━━━━━━━━━━━━━━━━━╮
   🐛 BUG REPORT
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName} (@${userNumber})

┌─── 📋 HOW TO REPORT ───
│ Format: ${config.prefix}report <your message>
│
│ Example:
│ ${config.prefix}report Menu not loading on my phone
│ ${config.prefix}report Video download fails for YouTube
│
│ Include:
│ • What happened
│ • Expected result
│ • Your device type
│ • Error screenshot (if any)
└─────────────────────

┌─── 📤 SUBMISSION ───
│ Reports go directly to:
│ 👑 ${config.developerName}
│ 📱 ${config.channelUrl}
│ ⚡ Response: Usually < 24hrs
└─────────────────────

💡 Be specific for faster fixes!`;

                return await conn.sendMessage(from, {
                    text: fancy(usageBody),
                    mentions: [sender]
                }, { quoted: msg });
            }

            // ✅ Report submitted
            const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' });
            
            const confirmBody = `╭━━━━━━━━━━━━━━━━━━╮
   ✅ REPORT RECEIVED
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName} (@${userNumber})

┌─── 📋 YOUR REPORT ───
│ 🕐 Time: ${timestamp}
│ 📝 Message: "${reportMsg}"
│ 📊 Status: 🟡 Pending Review
│ 🎫 ID: #${Math.random().toString(36).slice(2, 8).toUpperCase()}
└─────────────────────

┌─── 🔄 NEXT STEPS ───
│ 1. Developer will review your report
│ 2. You'll be notified via WhatsApp
│ 3. Fix will be deployed in next update
│ 4. Check ${config.prefix}changelog for updates
└─────────────────────

🙏 Thank you for helping improve INSIDIOUS!`;

            // 📤 Optional: Forward report to developer (if configured)
            if (config.reportWebhook) {
                try {
                    const axios = require('axios');
                    await axios.post(config.reportWebhook, {
                        user: userName,
                        number: userNumber,
                        report: reportMsg,
                        timestamp: timestamp,
                        platform: 'WhatsApp'
                    });
                } catch (e) {
                    console.warn("⚠️ Report webhook failed:", e.message);
                }
            }

            const buttons = [
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `📊 Check Status`,
                        id: `${config.prefix}status`
                    })
                },
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `💬 Contact Dev`,
                        id: `${config.prefix}owner`
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

            await conn.sendMessage(from, {
                text: fancy(confirmBody),
                mentions: [sender]
            }, { quoted: msg });

        } catch (e) {
            console.error("❌ Report Error:", e);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to submit report. Try: ${config.prefix}owner`) }, { quoted: msg });
        }
    }
};

