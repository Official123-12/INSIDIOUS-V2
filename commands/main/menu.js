const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/tools');
const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

module.exports = {
    name: "menu",
    aliases: ["help", "commands", "cmd"],
    description: "Show interactive menu with all commands",
    
    execute: async (conn, msg, args, { from, sender, pushname, reply }) => {
        try {
            // ========== GET REAL USERNAME ==========
            let userName = pushname || 'User';
            if (!userName || userName === 'undefined') {
                try {
                    // Try to get from store
                    const store = conn.contacts || {};
                    const contact = store[sender];
                    userName = contact?.name || contact?.pushname || sender.split('@')[0];
                } catch {
                    userName = sender.split('@')[0];
                }
            }
            
            const userNumber = sender.split('@')[0];
            const mentionText = `@${userNumber}`;
            const mentions = [sender];

            // ========== SCAN COMMANDS ==========
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = fs.readdirSync(cmdPath).filter(cat => 
                fs.statSync(path.join(cmdPath, cat)).isDirectory()
            ).sort();

            // Check if navigation request
            let targetCategory = null;
            let targetPage = 0;
            
            if (args[0] === 'nav' && args[1]) {
                targetCategory = args[1];
                targetPage = parseInt(args[2]) || 0;
            }

            const displayCategories = targetCategory ? [targetCategory] : categories;
            const CARDS_PER_CATEGORY = 1; // One card per category per message
            
            const cards = [];
            const COMMANDS_PER_PAGE = 5; // Medium size - not too many, not too few

            for (const cat of displayCategories) {
                const catPath = path.join(cmdPath, cat);
                let files = fs.readdirSync(catPath)
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace('.js', ''))
                    .sort();

                if (files.length === 0) continue;

                // Split into pages
                const pages = [];
                for (let i = 0; i < files.length; i += COMMANDS_PER_PAGE) {
                    pages.push(files.slice(i, i + COMMANDS_PER_PAGE));
                }

                // Get target page
                const currentPage = targetCategory === cat ? Math.min(targetPage, pages.length - 1) : 0;
                const pageFiles = pages[currentPage] || [];

                if (pageFiles.length === 0) continue;

                // Build buttons - PREMIUM DESIGN
                const buttons = [];

                // Command buttons with premium styling
                pageFiles.forEach((cmd, index) => {
                    // Get command description if available
                    let cmdModule;
                    try {
                        cmdModule = require(path.join(catPath, `${cmd}.js`));
                    } catch {}

                    const displayText = cmdModule?.description 
                        ? `${config.prefix}${cmd}` 
                        : `${config.prefix}${cmd}`;
                    
                    const id = `${config.prefix}${cmd}`;

                    buttons.push({
                        header: fancy(`${index + 1}. ${cmd.toUpperCase()}`),
                        title: fancy(cmdModule?.description || 'Execute command'),
                        description: fancy(`Click to run ${config.prefix}${cmd}`),
                        id: id
                    });
                });

                // Navigation buttons
                if (pages.length > 1) {
                    const navButtons = [];
                    
                    if (currentPage > 0) {
                        navButtons.push({
                            header: fancy("⬅️ BACK"),
                            title: fancy("Previous Page"),
                            description: fancy(`Go to page ${currentPage}`),
                            id: `${config.prefix}nav ${cat} ${currentPage - 1}`
                        });
                    }
                    
                    if (currentPage < pages.length - 1) {
                        navButtons.push({
                            header: fancy("NEXT ➡️"),
                            title: fancy("Next Page"),
                            description: fancy(`Go to page ${currentPage + 2}/${pages.length}`),
                            id: `${config.prefix}nav ${cat} ${currentPage + 1}`
                        });
                    }

                    // Add separator
                    if (navButtons.length > 0) {
                        buttons.push(...navButtons);
                    }
                }

                // Quick back to all categories
                if (targetCategory) {
                    buttons.push({
                        header: fancy("🔙 MENU"),
                        title: fancy("All Categories"),
                        description: fancy("Back to main menu"),
                        id: `${config.prefix}menu`
                    });
                }

                // Card content - MEDIUM SIZE, COMPACT
                const totalCmds = files.length;
                const pageIndicator = pages.length > 1 ? ` [${currentPage + 1}/${pages.length}]` : '';
                
                const cardBody = `╭───✦ ${cat.toUpperCase()}${pageIndicator} ✦───╮

👤 *User:* ${userName}
#️⃣ *Number:* ${mentionText}
📊 *Total:* ${totalCmds} commands

Tap below to execute:`;

                const cardFooter = pages.length > 1 
                    ? `Page ${currentPage + 1} of ${pages.length} • ${config.botName}`
                    : `${config.botName} • v2.1.2`;

                // Create card with image if available
                let cardHeader = {};
                if (config.menuImage && cards.length === 0) {
                    try {
                        cardHeader = {
                            hasMediaAttachment: true,
                            imageMessage: {
                                url: config.menuImage,
                                caption: fancy(config.botName)
                            }
                        };
                    } catch {
                        cardHeader = {
                            hasMediaAttachment: false,
                            title: fancy(`✦ ${cat.toUpperCase()} ✦`)
                        };
                    }
                } else {
                    cardHeader = {
                        hasMediaAttachment: false,
                        title: fancy(`✦ ${cat.toUpperCase()} ✦`)
                    };
                }

                // Build card - COMPACT DESIGN
                const card = {
                    body: { 
                        text: fancy(cardBody),
                        format: 1 // WhatsApp format
                    },
                    footer: { 
                        text: fancy(cardFooter)
                    },
                    header: cardHeader,
                    nativeFlowMessage: {
                        buttons: buttons.map(btn => ({
                            name: "single_select",
                            buttonParamsJson: JSON.stringify({
                                title: btn.header,
                                sections: [{
                                    title: btn.title,
                                    rows: [{
                                        header: btn.header,
                                        title: btn.title,
                                        description: btn.description,
                                        id: btn.id
                                    }]
                                }]
                            })
                        }))
                    }
                };

                // Alternative: Use list message for better compatibility
                if (buttons.length <= 5) {
                    // Use simple buttons for small lists
                    card.nativeFlowMessage = {
                        buttons: buttons.map(btn => ({
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: btn.header,
                                id: btn.id
                            })
                        }))
                    };
                }

                cards.push(card);
            }

            // If no cards, show error
            if (cards.length === 0) {
                return reply(fancy("❌ No commands found or invalid category."));
            }

            // ========== SEND MESSAGE ==========
            // Use different methods for compatibility
            
            if (cards.length === 1) {
                // Single category - send simple interactive message
                const card = cards[0];
                
                // Method 1: List Message (Best compatibility)
                const listMessage = {
                    text: card.body.text,
                    footer: card.footer.text,
                    title: card.header.title || fancy(config.botName),
                    buttonText: fancy("📜 COMMANDS"),
                    sections: [
                        {
                            title: fancy("Available Commands"),
                            rows: card.nativeFlowMessage.buttons.map((btn, idx) => {
                                const params = JSON.parse(btn.buttonParamsJson);
                                return {
                                    title: params.display_text || `Command ${idx + 1}`,
                                    rowId: params.id,
                                    description: params.display_text
                                };
                            })
                        }
                    ],
                    mentions: mentions
                };

                try {
                    await conn.sendMessage(from, listMessage, { quoted: msg });
                } catch (listError) {
                    // Fallback to template buttons
                    await sendTemplateButtons(conn, from, card, mentions, msg);
                }
            } else {
                // Multiple categories - send carousel or multiple messages
                for (let i = 0; i < Math.min(cards.length, 3); i++) { // Max 3 cards to avoid spam
                    const card = cards[i];
                    
                    try {
                        // Try carousel first
                        const interactiveMessage = {
                            body: card.body,
                            footer: card.footer,
                            header: card.header,
                            carouselMessage: {
                                cards: [card]
                            }
                        };

                        const messageContent = { interactiveMessage };
                        const waMessage = generateWAMessageFromContent(from, messageContent, {
                            userJid: conn.user.id
                        });
                        
                        await conn.relayMessage(from, waMessage.message, { 
                            messageId: waMessage.key.id,
                            mentions: mentions 
                        });
                    } catch (carouselError) {
                        // Fallback to simple message
                        await sendSimpleMenu(conn, from, card, mentions, msg);
                    }
                    
                    // Small delay between cards
                    if (i < cards.length - 1) {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }

            // Send help tip
            setTimeout(async () => {
                try {
                    await conn.sendMessage(from, {
                        text: fancy(`💡 *Tip:* Reply with command name or tap the buttons above.\n🔍 Example: ${config.prefix}help`),
                        mentions: mentions
                    });
                } catch {}
            }, 1000);

        } catch (e) {
            console.error("Menu error:", e);
            
            // ========== FALLBACK TEXT MENU ==========
            try {
                const userNumber = sender.split('@')[0];
                let text = `╭━━━━━━━━━━━━━━╮\n   👁 INSIDIOUS V2\n╰━━━━━━━━━━━━━━╯\n\n`;
                text += `👤 User: @${userNumber}\n⏱️ Uptime: ${runtime(process.uptime())}\n\n`;
                
                const cmdPath = path.join(__dirname, '../../commands');
                const categories = fs.readdirSync(cmdPath).filter(cat => 
                    fs.statSync(path.join(cmdPath, cat)).isDirectory()
                );
                
                for (const cat of categories.slice(0, 6)) { // Limit categories in fallback
                    const catPath = path.join(cmdPath, cat);
                    const files = fs.readdirSync(catPath)
                        .filter(f => f.endsWith('.js'))
                        .map(f => f.replace('.js', ''));
                    
                    if (files.length) {
                        text += `✦ *${cat.toUpperCase()}*\n`;
                        text += files.slice(0, 5).map(cmd => `${config.prefix}${cmd}`).join(' • ') + '\n';
                        if (files.length > 5) text += `...and ${files.length - 5} more\n`;
                        text += '\n';
                    }
                }
                
                text += `━━━━━━━━━━━━━━\n👑 ${config.developerName || 'STANYTZ'}`;
                
                await conn.sendMessage(from, { 
                    text: fancy(text), 
                    mentions: [sender] 
                }, { quoted: msg });
                
            } catch (fallbackError) {
                console.error("Fallback menu failed:", fallbackError);
                await reply(fancy("❌ Menu failed. Try: " + config.prefix + "help"));
            }
        }
    }
};

// ========== HELPER FUNCTIONS ==========

async function sendTemplateButtons(conn, from, card, mentions, quotedMsg) {
    try {
        const buttons = card.nativeFlowMessage.buttons.map(btn => {
            const params = JSON.parse(btn.buttonParamsJson);
            return {
                buttonId: params.id,
                buttonText: { displayText: fancy(params.display_text) },
                type: 1
            };
        });

        const buttonMessage = {
            text: card.body.text,
            footer: card.footer.text,
            buttons: buttons.slice(0, 3), // Max 3 buttons
            headerType: card.header.hasMediaAttachment ? 4 : 1,
            mentions: mentions
        };

        if (card.header.hasMediaAttachment && card.header.imageMessage) {
            buttonMessage.image = { url: card.header.imageMessage.url };
            buttonMessage.caption = card.body.text;
        }

        await conn.sendMessage(from, buttonMessage, { quoted: quotedMsg });
    } catch (e) {
        throw e;
    }
}

async function sendSimpleMenu(conn, from, card, mentions, quotedMsg) {
    try {
        // Simple text with buttons as separate messages
        await conn.sendMessage(from, {
            text: card.body.text + '\n\n' + card.footer.text,
            mentions: mentions
        }, { quoted: quotedMsg });

        // Send commands as numbered list
        const commands = card.nativeFlowMessage.buttons.map((btn, idx) => {
            const params = JSON.parse(btn.buttonParamsJson);
            return `${idx + 1}. ${params.display_text}`;
        }).join('\n');

        await conn.sendMessage(from, {
            text: fancy(commands),
            mentions: mentions
        });
    } catch (e) {
        throw e;
    }
}
