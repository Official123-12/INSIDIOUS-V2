const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
    name: "search",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // ========== 🎯 USER INFO ==========
            const userNumber = sender.split('@')[0];
            let userName = pushname?.trim() || `User_${userNumber.slice(-4)}`;
            try {
                const contact = conn.contactStore?.contacts?.[sender] || await conn.getContact(sender);
                userName = contact?.name || contact?.pushname || userName;
            } catch {}
            const mentions = [sender];

            // ========== 🔍 SEARCH LOGIC ==========
            let query = args.join(' ').toLowerCase();
            let currentPage = 0;

            // Check for pagination arguments (internal use)
            // Format: .search nav <query> <page>
            if (args[0] === 'nav' && args[1]) {
                query = args[1].toLowerCase();
                currentPage = parseInt(args[2]) || 0;
            }

            // Validate Query
            if (!query) {
                return conn.sendMessage(from, { 
                    text: fancy(`╭━━━ ✦ ✦ ✦ ━━━╮\n   🔍 SEARCH COMMAND\n╰━━━ ✦ ✦ ✦ ━━━╯\n\n⚠️ Please provide a keyword.\n\n💡 Example:\n${config.prefix}search play\n${config.prefix}search down\n\n👤 ${userName}`), 
                    mentions 
                }, { quoted: msg });
            }

            // Scan Commands
            const cmdPath = path.join(__dirname, '../../commands');
            const allCategories = fs.readdirSync(cmdPath).filter(cat => 
                fs.statSync(path.join(cmdPath, cat)).isDirectory()
            );

            const results = [];
            for (const cat of allCategories) {
                const catPath = path.join(cmdPath, cat);
                const files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js') && f !== 'index.js')
                    .map(f => f.replace('.js', ''));
                
                // Match query against command name
                const matches = files.filter(cmd => cmd.toLowerCase().includes(query));
                matches.forEach(cmd => {
                    results.push({ cmd, category: cat });
                });
            }

            // No Results Found
            if (results.length === 0) {
                return conn.sendMessage(from, { 
                    text: fancy(`╭━━━ ✦ ✦ ✦ ━━━╮\n   ❌ NO RESULTS\n╰━━━ ✦ ✦ ✦ ━━━╯\n\n🔍 Query: "${query}"\n\n😕 No commands found matching this keyword.\n\n💡 Tips:\n• Check spelling\n• Use shorter keywords\n• Type ${config.prefix}menu for full list\n\n👤 ${userName}`), 
                    mentions 
                }, { quoted: msg });
            }

            // ========== 📄 PAGINATION ==========
            const RESULTS_PER_PAGE = 5; // Max 5 buttons for clean UI
            const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
            
            // Ensure page is within bounds
            if (currentPage >= totalPages) currentPage = 0;
            
            const paginatedResults = results.slice(
                currentPage * RESULTS_PER_PAGE, 
                (currentPage + 1) * RESULTS_PER_PAGE
            );

            // ========== 🎨 BUTTONS ==========
            const buttons = [];
            
            // Command Execution Buttons
            paginatedResults.forEach((item, idx) => {
                const icons = ['⚡','🎯','🔧','✨','🚀'];
                buttons.push({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `${icons[idx]} ${item.cmd}`,
                        id: `${config.prefix}${item.cmd}` // Instant Execution
                    })
                });
            });

            // Navigation Buttons (if multiple pages)
            if (totalPages > 1) {
                if (currentPage > 0) {
                    buttons.push({
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: `◀ Prev`,
                            id: `${config.prefix}search nav ${query} ${currentPage - 1}`
                        })
                    });
                }
                if (currentPage < totalPages - 1) {
                    buttons.push({
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: `Next ▶`,
                            id: `${config.prefix}search nav ${query} ${currentPage + 1}`
                        })
                    });
                }
            }

            // Back to Menu Button
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `🏠 Back to Menu`,
                    id: `${config.prefix}menu`
                })
            });

            // ========== 📲 BUILD MESSAGE ==========
            const resultText = results.length === 1 ? '1 Result' : `${results.length} Results`;
            const pageInfo = totalPages > 1 ? `• Page ${currentPage + 1}/${totalPages}` : '';

            const interactiveMessage = {
                body: { 
                    text: fancy(`╭━━━ ✦ ✦ ✦ ━━━╮\n   🔍 SEARCH RESULTS\n╰━━━ ✦ ✦ ✦ ━━━╯\n\n📂 Query: "${query}"\n📊 Found: ${resultText} ${pageInfo}\n\n👤 ${userName}\n\n📌 Tap a button to run:`) 
                },
                footer: { 
                    text: fancy(`━━━ ✦ ✦ ✦ ━━━\n👑 ${config.developerName} • V2.2`) 
                },
                header: {
                    title: fancy(`🌟 ${config.botName}`),
                    hasMediaAttachment: false
                },
                nativeFlowMessage: { buttons }
            };

            const messageContent = { interactiveMessage };
            const waMessage = generateWAMessageFromContent(from, messageContent, {
                userJid: conn.user.id,
                upload: conn.waUploadToServer
            });

            await conn.relayMessage(from, waMessage.message, { 
                messageId: waMessage.key.id, 
                mentions 
            });

        } catch (e) {
            console.error("❌ Search Error:", e);
            
            // ========== 🆘 FALLBACK: TEXT SEARCH ==========
            const userNumber = sender.split('@')[0];
            let userName = pushname || `User_${userNumber.slice(-4)}`;
            try {
                const contact = await conn.getContact(sender);
                userName = contact?.name || contact?.pushname || userName;
            } catch {}

            let query = args.join(' ').toLowerCase();
            if (!query) return conn.sendMessage(from, { text: `❌ Usage: ${config.prefix}search <keyword>` }, { quoted: msg });

            const cmdPath = path.join(__dirname, '../../commands');
            const allCategories = fs.readdirSync(cmdPath).filter(cat => 
                fs.statSync(path.join(cmdPath, cat)).isDirectory()
            );

            let resultsText = '';
            let count = 0;
            for (const cat of allCategories) {
                const catPath = path.join(cmdPath, cat);
                const files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace('.js', ''));
                
                const matches = files.filter(cmd => cmd.toLowerCase().includes(query));
                if (matches.length) {
                    resultsText += `✦ ${cat.toUpperCase()}\n`;
                    resultsText += matches.map(cmd => `  ${config.prefix}${cmd}`).join('\n') + '\n\n';
                    count += matches.length;
                }
            }

            if (count === 0) {
                return conn.sendMessage(from, { text: `❌ No results found for "${query}"` }, { quoted: msg });
            }

            const text = `╭━━━ ✦ ✦ ✦ ━━━╮\n   🔍 SEARCH RESULTS\n╰━━━ ✦ ✦ ✦ ━━━╯\n\n📂 Query: "${query}"\n📊 Found: ${count} matches\n\n${resultsText}━━━ ✦ ✦ ✦ ━━━\n👑 ${config.developerName}`;
            await conn.sendMessage(from, { text: fancy(text), mentions: [sender] }, { quoted: msg });
        }
    }
};

