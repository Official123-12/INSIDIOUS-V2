/**
 * 🚀 INSIDIOUS NEXUS • SYSTEM STATS
 * 📊 Live RAM, CPU, Ping, Uptime, Database Info
 * 🇬🇧 English Only • Premium International Standard
 */

const os = require('os');
const { fancy, runtime } = require('../../lib/tools');
const config = require('../../config');

module.exports = {
    name: "stats",
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

            // ========== 📊 SYSTEM STATS ==========
            const uptimeSeconds = process.uptime();
            const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const ramTotal = (os.totalmem() / 1024 / 1024).toFixed(2);
            const ramPercent = ((ramUsage / ramTotal) * 100).toFixed(1);
            const cpuCores = os.cpus().length;
            const cpuModel = os.cpus()[0]?.model || 'Unknown';
            const platform = os.platform();
            const nodeVersion = process.version;
            const baileysVersion = require('@whiskeysockets/baileys/package.json').version;

            // ========== 📈 PING TEST ==========
            const startTime = Date.now();
            const pingMsg = await conn.sendMessage(from, { text: '📡' }, { quoted: msg });
            const endTime = Date.now();
            const ping = endTime - startTime;
            
            // Delete ping test message
            await conn.sendMessage(from, { delete: pingMsg.key });

            // ========== 🎨 BUILD STATS BODY ==========
            const statsBody = `╭━━━━━━━━━━━━━━━━━━╮
   📊 SYSTEM STATISTICS
╰━━━━━━━━━━━━━━━━━━╯

👤 ${userName} (@${userNumber})

┌─── ⚡ PERFORMANCE ───
│ 📡 Ping: ${ping}ms
│ ⏱️ Uptime: ${runtime(uptimeSeconds)}
│ 💾 RAM: ${ramUsage}MB / ${ramTotal}MB
│ 📊 Usage: ${ramPercent}%
│ 🖥️ CPU: ${cpuCores} Cores
│ 🔧 Model: ${cpuModel.split(' ').slice(0, 3).join(' ')}
└─────────────────────

┌─── 🛠️ SYSTEM INFO ───
│ 🌐 Platform: ${platform}
│ 🟢 Node.js: ${nodeVersion}
│ 📦 Baileys: v${baileysVersion}
│ 🤖 Bot: ${config.botName}
│ 👑 Dev: ${config.developerName}
└─────────────────────

💡 Tip: Use ${config.prefix}menu3 for dashboard`;

            // ========== 🎨 BUTTONS ==========
            const buttons = [
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `🔄 Refresh`,
                        id: `${config.prefix}stats`
                    })
                },
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `🚀 Nexus Menu`,
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
                text: fancy(statsBody),
                contextInfo: {
                    externalAdReply: {
                        title: "ɪɴꜱɪᴅɪᴏᴜꜱ : ꜱʏꜱᴛᴇᴍ ꜱᴛᴀᴛꜱ",
                        body: `📡 Ping: ${ping}ms • 💾 RAM: ${ramPercent}%`,
                        mediaType: 1,
                        thumbnailUrl: config.menuImage3,
                        renderLargerThumbnail: true,
                        sourceUrl: config.channelUrl,
                        showAdAttribution: true
                    }
                }
            }, { quoted: msg, mentions });

        } catch (e) {
            console.error("❌ Stats Error:", e);
            
            const userNumber = sender.split('@')[0];
            let userName = pushname || `User_${userNumber.slice(-4)}`;
            try {
                const contact = await conn.getContact(sender);
                userName = contact?.name || contact?.pushname || userName;
            } catch {}

            const text = `╭━━━━━━━━━━━━━━━━━━╮\n   📊 SYSTEM STATS\n╰━━━━━━━━━━━━━━━━━━╯\n\n👤 ${userName}\n⏱️ Uptime: ${runtime(process.uptime())}\n💾 RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB\n\n━━━ 🚀 ━━━\n👑 ${config.developerName}`;
            await conn.sendMessage(from, { text: fancy(text), mentions: [sender] }, { quoted: msg });
        }
    }
};

