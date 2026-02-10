const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');

// DATABASE MODELS WITH ERROR HANDLING
let User, Group, ChannelSubscriber, Settings;
try {
    const models = require('./database/models');
    User = models.User;
    Group = models.Group;
    ChannelSubscriber = models.ChannelSubscriber;
    Settings = models.Settings;
} catch (error) {
    console.log(fancy("⚠️ Using mock database models"));
    User = { 
        findOne: async () => null, 
        countDocuments: async () => 0, 
        find: async () => [], 
        create: async () => ({}), 
        findOneAndUpdate: async () => ({}) 
    };
    Group = { 
        findOne: async () => null, 
        countDocuments: async () => 0 
    };
    ChannelSubscriber = { 
        findOne: async () => null, 
        countDocuments: async () => 0, 
        find: async () => [], 
        create: async () => ({}), 
        findOneAndUpdate: async () => ({}) 
    };
    Settings = { 
        findOne: async () => null, 
        create: async () => ({}) 
    };
}

// MESSAGE STORE FOR ANTI-DELETE/VIEWONCE
const messageStore = new Map();
const MAX_STORE_SIZE = 1000;

// BOT OWNER JID
let botOwnerJid = null;

// ============================================
// HELPER FUNCTIONS
// ============================================

// GET USERNAME FROM JID
function getUsername(jid) {
    try {
        if (!jid) return "Unknown";
        const parts = jid.split('@');
        return parts[0] || "Unknown";
    } catch {
        return "Unknown";
    }
}

// GET DISPLAY NAME
async function getDisplayName(conn, jid) {
    try {
        if (!jid) return "Unknown";
        
        // First try to get from database
        const user = await User.findOne({ jid: jid });
        if (user && user.name) {
            return user.name;
        }
        
        // If in group, try to get participant name
        if (jid.includes('@g.us')) {
            try {
                const metadata = await conn.groupMetadata(jid);
                const participant = metadata.participants.find(p => p.id === jid);
                if (participant && participant.notify) {
                    return participant.notify;
                }
            } catch (e) {}
        }
        
        // Return username as fallback
        return getUsername(jid);
    } catch {
        return getUsername(jid);
    }
}

// GET GROUP NAME
async function getGroupName(conn, groupJid) {
    try {
        const metadata = await conn.groupMetadata(groupJid);
        return metadata.subject || "Group Chat";
    } catch {
        return "Group Chat";
    }
}

// CREATE SIMPLE REPLY FUNCTION
function createReplyFunction(conn, from, msg) {
    return async function(text, options = {}) {
        try {
            const messageText = typeof text === 'string' ? fancy(text) : text;
            const messageOptions = {
                text: messageText,
                ...options
            };
            
            if (msg && msg.key) {
                return await conn.sendMessage(from, messageOptions, { quoted: msg });
            } else {
                return await conn.sendMessage(from, messageOptions);
            }
        } catch (error) {
            console.error('Reply error:', error.message);
            return null;
        }
    };
}

// ============================================
// FIXED COMMAND LOADER - SUPPORTS OLD & NEW FORMAT
// ============================================
async function loadCommand(command, conn, from, msg, args, settings, isOwner, sender, pushname, isGroup) {
    try {
        const cmdPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(cmdPath)) {
            const reply = createReplyFunction(conn, from, msg);
            await reply(fancy("❌ Commands directory not found!"));
            return;
        }

        // Find command file
        let commandFile = null;
        const categories = fs.readdirSync(cmdPath);
        
        for (const cat of categories) {
            const categoryPath = path.join(cmdPath, cat);
            if (!fs.statSync(categoryPath).isDirectory()) continue;
            
            const possibleFile = path.join(categoryPath, `${command}.js`);
            if (fs.existsSync(possibleFile)) {
                commandFile = possibleFile;
                break;
            }
        }
        
        if (!commandFile) {
            const reply = createReplyFunction(conn, from, msg);
            await reply(fancy(`❌ Command "${command}" not found!\nUse ${config.prefix || '.'}menu for commands.`));
            return;
        }
        
        // Clear cache and load command
        delete require.cache[require.resolve(commandFile)];
        const cmdModule = require(commandFile);
        const reply = createReplyFunction(conn, from, msg);
        
        // Check permissions
        if (cmdModule.ownerOnly && !isOwner) {
            await reply(fancy("❌ This command is only for bot owner!"));
            return;
        }
        
        if (cmdModule.adminOnly && isGroup && !isOwner) {
            try {
                const metadata = await conn.groupMetadata(from);
                const participant = metadata.participants.find(p => p.id === sender);
                const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                
                if (!isAdmin) {
                    await reply(fancy("❌ This command is only for group admins!"));
                    return;
                }
            } catch (e) {
                await reply(fancy("❌ Could not verify admin status!"));
                return;
            }
        }
        
        // Check command structure and execute
        // FOR OLD FORMAT: execute(conn, msg, args, { from, fancy, reply })
        if (cmdModule.execute && cmdModule.execute.length === 4) {
            // Old format
            try {
                const extraParams = { 
                    from: from, 
                    fancy: fancy,
                    reply: reply,
                    conn: conn,
                    msg: msg,
                    args: args,
                    sender: sender,
                    isOwner: isOwner,
                    pushname: pushname,
                    settings: settings || {},
                    config: config
                };
                
                await cmdModule.execute(conn, msg, args, extraParams);
            } catch (error) {
                console.error(`Command "${command}" execution error:`, error);
                await reply(fancy(`❌ Error in "${command}": ${error.message}`));
            }
        } 
        // FOR NEW FORMAT: execute(context)
        else if (typeof cmdModule.execute === 'function') {
            // New format
            try {
                const context = {
                    conn: conn,
                    msg: msg,
                    args: args,
                    from: from,
                    sender: sender,
                    isGroup: isGroup,
                    isOwner: isOwner,
                    pushname: pushname,
                    reply: reply,
                    fancy: fancy,
                    config: config,
                    settings: settings || {}
                };
                
                await cmdModule.execute(context);
            } catch (error) {
                console.error(`Command "${command}" execution error:`, error);
                await reply(fancy(`❌ Error in "${command}": ${error.message}`));
            }
        } 
        // FOR DIRECT FUNCTION
        else if (typeof cmdModule === 'function') {
            try {
                await cmdModule({ conn, msg, args, from, fancy, reply, sender, isOwner, pushname });
            } catch (error) {
                console.error(`Command "${command}" execution error:`, error);
                await reply(fancy(`❌ Error in "${command}": ${error.message}`));
            }
        } 
        else {
            await reply(fancy(`❌ Invalid command structure for "${command}"`));
        }
        
    } catch (error) {
        console.error(`Command "${command}" loading error:`, error);
        try {
            const reply = createReplyFunction(conn, from, msg);
            await reply(fancy(`❌ Error loading "${command}": ${error.message}`));
        } catch (e) {}
    }
}

// ============================================
// ANTI-VIEWONCE HANDLER (SENDS TO OWNER)
// ============================================
async function handleViewOnce(conn, msg, sender, pushname, from, isGroup) {
    try {
        if (!botOwnerJid) return false;
        
        // Get settings
        let settings = {};
        try {
            settings = await Settings.findOne() || {};
        } catch (e) {}
        
        if (!settings.antiviewonce && !config.antiviewonce) return false;
        
        const viewOnceMsg = msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage;
        if (!viewOnceMsg) return false;
        
        // Get sender info
        let senderInfo = await getDisplayName(conn, sender);
        let groupInfo = "";
        
        if (isGroup) {
            try {
                const groupName = await getGroupName(conn, from);
                groupInfo = `📛 *Group:* ${groupName}\n`;
            } catch (e) {}
        }
        
        // Send notification to owner
        const notification = `
╭─── • 🥀 • ───╮
   𝗩𝗜𝗘𝗪-𝗢𝗡𝗖𝗘 𝗗𝗘𝗧𝗘𝗖𝗧𝗘𝗗
╰─── • 🥀 • ───╯

👤 *User:* ${senderInfo}
📞 *Number:* ${getUsername(sender)}
${groupInfo}🕐 *Time:* ${new Date().toLocaleTimeString()}

⚠️ *Type:* ${viewOnceMsg.imageMessage ? 'Image' : viewOnceMsg.videoMessage ? 'Video' : 'Media'}
🔒 *Status:* Message will disappear after viewing

${fancy("View-once message captured by Insidious")}`;
        
        await conn.sendMessage(botOwnerJid, { text: notification });
        
        return true;
    } catch (error) {
        console.error("View-once error:", error.message);
        return false;
    }
}

// ============================================
// ANTI-DELETE HANDLER (SENDS TO OWNER)
// ============================================
async function handleAntiDelete(conn, msg, sender, pushname, from, isGroup) {
    try {
        if (!botOwnerJid) return false;
        
        // Get settings
        let settings = {};
        try {
            settings = await Settings.findOne() || {};
        } catch (e) {}
        
        if (!settings.antidelete && !config.antidelete) return false;
        
        if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) {
            return false;
        }
        
        // Get sender info
        let senderInfo = await getDisplayName(conn, sender);
        let groupInfo = "";
        
        if (isGroup) {
            try {
                const groupName = await getGroupName(conn, from);
                groupInfo = `📛 *Group:* ${groupName}\n`;
            } catch (e) {}
        }
        
        // Send notification to owner
        const notification = `
╭─── • 🥀 • ───╮
   𝗗𝗘𝗟𝗘𝗧𝗘𝗗 𝗠𝗘𝗦𝗦𝗔𝗚𝗘
╰─── • 🥀 • ───╯

👤 *User:* ${senderInfo}
📞 *Number:* ${getUsername(sender)}
${groupInfo}🕐 *Time:* ${new Date().toLocaleTimeString()}

🗑️ A message was deleted by sender

${fancy("Message deletion captured by Insidious")}`;
        
        await conn.sendMessage(botOwnerJid, { text: notification });
        
        return true;
    } catch (error) {
        console.error("Anti-delete error:", error.message);
        return false;
    }
}

// ============================================
// STORE MESSAGE FOR TRACKING
// ============================================
async function storeMessage(msg, body, sender, from, isGroup) {
    try {
        const storeKey = msg.key.id;
        
        // Don't store bot's own messages
        if (msg.key.fromMe) return;
        
        // Don't store empty messages
        if (!body && !msg.message?.imageMessage && !msg.message?.videoMessage) return;
        
        messageStore.set(storeKey, {
            content: body || (msg.message?.imageMessage ? "[Image]" : msg.message?.videoMessage ? "[Video]" : "[Media]"),
            sender: sender,
            from: from,
            isGroup: isGroup,
            timestamp: new Date(),
            messageId: msg.key.id
        });
        
        // Clean up old messages
        if (messageStore.size > MAX_STORE_SIZE) {
            const keys = Array.from(messageStore.keys()).slice(0, 100);
            keys.forEach(key => messageStore.delete(key));
        }
    } catch (error) {
        // Silent error
    }
}

// ============================================
// ANTI-LINK HANDLER
// ============================================
async function handleAntiLink(conn, msg, from, sender, body, isGroup) {
    try {
        if (!isGroup) return false;
        
        let settings = {};
        try {
            settings = await Settings.findOne() || {};
        } catch (e) {}
        
        if (!settings.antilink && !config.antilink) return false;
        
        // Check for URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const hasLink = urlRegex.test(body);
        
        if (hasLink) {
            // Delete the message
            try {
                await conn.sendMessage(from, { delete: msg.key });
            } catch (e) {}
            
            // Warn the user
            const senderName = await getDisplayName(conn, sender);
            const warningMsg = `⚠️ @${getUsername(sender)}, Links are not allowed in this group!`;
            
            await conn.sendMessage(from, {
                text: fancy(warningMsg),
                mentions: [sender]
            });
            
            return true;
        }
    } catch (e) {
        console.error("Anti-link error:", e.message);
    }
    return false;
}

// ============================================
// POLLINATIONS AI CHATBOT
// ============================================
async function getPollinationsAIResponse(userMessage) {
    try {
        const cleanMessage = userMessage.trim();
        const encodedMessage = encodeURIComponent(cleanMessage);
        
        const systemPrompt = encodeURIComponent(`
You are INSIDIOUS V2, a human-like AI assistant with emotions.
Detect user's language and reply in EXACTLY the same language.
If Swahili, reply in Swahili. If English, reply in English.
Be conversational, natural, and show emotions.
Use appropriate emojis. Be a friend, not just a bot.
`);
        
        const apiUrl = `https://text.pollinations.ai/${encodedMessage}?prompt=${systemPrompt}&model=chatgpt&temperature=0.8`;
        
        const response = await axios.get(apiUrl, { timeout: 10000 });
        
        if (response.data && response.data.trim()) {
            return response.data.trim();
        }
        
        return "I'm here! 😊 What's up?";
    } catch (error) {
        console.error('AI Error:', error.message);
        return "Hey there! 😊 How can I help you today?";
    }
}

// ============================================
// CHATBOT HANDLER
// ============================================
async function handleChatbot(conn, from, body, sender, isOwner) {
    try {
        if (!body || body.trim().length < 1) return false;
        
        let settings = {};
        try {
            settings = await Settings.findOne() || {};
        } catch (e) {}
        
        if (!settings.chatbot && !config.chatbot) return false;
        
        // Ignore commands
        if (body.startsWith(config.prefix || '.')) return false;
        
        // Typing indicator
        try {
            await conn.sendPresenceUpdate('composing', from);
            setTimeout(async () => {
                try {
                    await conn.sendPresenceUpdate('paused', from);
                } catch (e) {}
            }, 2000);
        } catch (e) {}
        
        // Get AI response
        const aiResponse = await getPollinationsAIResponse(body);
        
        // Format response nicely
        const formattedResponse = `
╭─── • 🥀 • ───╮
   ɪɴꜱɪᴅɪᴏᴜꜱ ᴀɪ
╰─── • 🥀 • ───╯

${aiResponse}

${fancy("💕 Your AI friend")}`;
        
        await conn.sendMessage(from, { text: formattedResponse });
        
        return true;
    } catch (error) {
        console.error("Chatbot error:", error.message);
        return false;
    }
}

// ============================================
// MAIN HANDLER (FIXED)
// ============================================
module.exports = async (conn, m) => {
    try {
        if (!m || !m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        // SAFE EXTRACTION OF MESSAGE PROPERTIES
        const from = msg.key?.remoteJid;
        const sender = msg.key?.participant || msg.key?.remoteJid;
        const pushname = msg.pushName || "User";
        
        if (!from || !sender) return;
        
        // Extract message body safely
        let body = "";
        try {
            if (msg.message.conversation) {
                body = msg.message.conversation;
            } else if (msg.message.extendedTextMessage?.text) {
                body = msg.message.extendedTextMessage.text;
            } else if (msg.message.imageMessage?.caption) {
                body = msg.message.imageMessage.caption || "";
            } else if (msg.message.videoMessage?.caption) {
                body = msg.message.videoMessage.caption || "";
            } else if (msg.message?.viewOnceMessageV2?.message?.conversation) {
                body = msg.message.viewOnceMessageV2.message.conversation || "";
            } else if (msg.message?.viewOnceMessage?.message?.conversation) {
                body = msg.message.viewOnceMessage.message.conversation || "";
            }
        } catch (e) {
            body = "";
        }
        
        const isGroup = from.endsWith('@g.us');
        const isCmd = body && body.startsWith(config.prefix || '.');
        const command = isCmd ? body.slice((config.prefix || '.').length).trim().split(' ')[0].toLowerCase() : '';
        const args = isCmd ? body.trim().split(/ +/).slice(1) : [];
        
        // SET BOT OWNER
        if (!botOwnerJid && conn.user) {
            botOwnerJid = conn.user.id;
            console.log(fancy(`[OWNER] Bot owner: ${getUsername(botOwnerJid)}`));
        }
        
        // Check if sender is owner
        const isOwner = botOwnerJid ? (sender === botOwnerJid || msg.key?.fromMe) : false;
        
        // LOAD SETTINGS
        let settings = {};
        try {
            settings = await Settings.findOne() || {};
        } catch (e) {
            settings = config;
        }
        
        // STORE MESSAGE FOR TRACKING
        await storeMessage(msg, body, sender, from, isGroup);
        
        // ANTI-VIEWONCE (SENDS TO OWNER IMMEDIATELY)
        if (await handleViewOnce(conn, msg, sender, pushname, from, isGroup)) {
            return;
        }
        
        // ANTI-DELETE (SENDS TO OWNER IMMEDIATELY)
        if (await handleAntiDelete(conn, msg, sender, pushname, from, isGroup)) {
            return;
        }
        
        // AUTO READ MESSAGES
        if (settings.autoRead || config.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (e) {}
        }
        
        // GROUP ANTI-FEATURES
        if (isGroup && body) {
            if (await handleAntiLink(conn, msg, from, sender, body, isGroup)) return;
        }
        
        // COMMAND HANDLING - FIXED
        if (isCmd && command) {
            // Check if command is allowed
            if (!isOwner && !isGroup) {
                // Only owner can use commands in private chat
                const reply = createReplyFunction(conn, from, msg);
                await reply(fancy("❌ Commands are only available in groups or for owner!"));
                return;
            }
            
            if (isGroup && !isOwner) {
                // In groups, only admins can use commands
                try {
                    const metadata = await conn.groupMetadata(from);
                    const participant = metadata.participants.find(p => p.id === sender);
                    const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                    
                    if (!isAdmin) {
                        const reply = createReplyFunction(conn, from, msg);
                        await reply(fancy("❌ Only admins can use commands!"));
                        return;
                    }
                } catch (e) {
                    const reply = createReplyFunction(conn, from, msg);
                    await reply(fancy("❌ Could not verify admin status!"));
                    return;
                }
            }
            
            await loadCommand(command, conn, from, msg, args, settings, isOwner, sender, pushname, isGroup);
            return;
        }
        
        // CHATBOT
        if (body && body.trim().length > 0 && !isCmd && !msg.key?.fromMe) {
            await handleChatbot(conn, from, body, sender, isOwner);
            return;
        }
        
    } catch (err) {
        console.error("Handler Error:", err.message);
    }
};

// ============================================
// INITIALIZATION
// ============================================
module.exports.init = async (conn) => {
    try {
        console.log(fancy('[SYSTEM] Initializing Insidious...'));
        
        // Set bot owner
        if (conn.user) {
            botOwnerJid = conn.user.id;
            console.log(fancy(`[OWNER] Bot Owner: ${getUsername(botOwnerJid)}`));
            
            // Send initialization message to owner
            const initMsg = `
╭─── • 🥀 • ───╮
   ${fancy(config.botName)} ᴠ${config.version}
╰─── • 🥀 • ───╯

✅ *System Initialized*
👤 Bot Owner: ${getUsername(botOwnerJid)}
🕐 Time: ${new Date().toLocaleString()}

⚙️ *Active Features:*
• Anti-delete: ✅
• Anti-viewonce: ✅  
• Chatbot: ✅
• Command System: ✅

${fancy("All systems operational.")}`;
            
            // Send to bot owner
            if (config.ownerNumber && Array.isArray(config.ownerNumber) && config.ownerNumber.length > 0) {
                const ownerNum = config.ownerNumber[0];
                if (ownerNum) {
                    const ownerJid = ownerNum + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { text: initMsg });
                }
            }
        }
        
        console.log(fancy('[SYSTEM] ✅ Bot initialized successfully'));
        
    } catch (error) {
        console.error('Init error:', error.message);
    }
};
