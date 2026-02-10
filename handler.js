const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');

// LOAD DATABASE MODELS SAFELY
let User, Group, ChannelSubscriber, Settings;
try {
    const models = require('./database/models');
    User = models.User;
    Group = models.Group;
    ChannelSubscriber = models.ChannelSubscriber;
    Settings = models.Settings;
} catch (error) {
    console.log("⚠️ Using fallback models");
    User = { 
        findOne: async () => null, 
        countDocuments: async () => 0,
        find: async () => [],
        updateOne: async () => null,
        create: async (data) => ({ ...data, save: async () => null })
    };
    Group = { 
        findOne: async () => null, 
        countDocuments: async () => 0,
        find: async () => [],
        updateOne: async () => null
    };
    Settings = { 
        findOne: async () => ({ 
            antilink: true, antiporn: true, antiscam: true, antimedia: false, antitag: true,
            antiviewonce: true, antidelete: true, sleepingMode: false, welcomeGoodbye: true,
            chatbot: true, autoRead: true, autoReact: true, autoBio: true, anticall: true,
            antispam: true, antibug: true, autoStatus: true, autoStatusReply: true,
            autoRecording: true, autoSave: false, downloadStatus: false,
            activeMembers: false, autoblockCountry: false,
            save: async function() { return this; }
        }) 
    };
    ChannelSubscriber = { findOne: async () => null };
}

// MESSAGE STORES
const messageStore = new Map();
const spamTracker = new Map();
const warningTracker = new Map();

// BOT OWNER JID
let botOwnerJid = null;

// ============================================
// HELPER FUNCTIONS
// ============================================

function getUsername(jid) {
    try {
        return jid.split('@')[0];
    } catch {
        return "Unknown";
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function isBotAdmin(conn, groupJid) {
    try {
        if (!conn.user?.id || !groupJid) return false;
        
        const metadata = await conn.groupMetadata(groupJid);
        const participant = metadata.participants.find(p => p.id === conn.user.id);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch {
        return false;
    }
}

function createReply(conn, from, msg) {
    return async function(text, options = {}) {
        try {
            if (msg && msg.key) {
                return await conn.sendMessage(from, { text, ...options }, { quoted: msg });
            } else {
                return await conn.sendMessage(from, { text, ...options });
            }
        } catch (error) {
            console.error('Reply error:', error.message);
            return null;
        }
    };
}

// ============================================
// AI CHATBOT - POLLINATIONS.AI (NO SIMULATION)
// ============================================
async function getAIResponse(userMessage) {
    try {
        const encodedMessage = encodeURIComponent(userMessage);
        const apiUrl = `https://text.pollinations.ai/${encodedMessage}`;
        
        const response = await axios.get(apiUrl, { timeout: 10000 });
        
        if (response.data && response.data.trim()) {
            return response.data.trim();
        }
        
        // Fallback responses
        const responses = [
            "Hello! How can I help you today? 😊",
            "Hey there! What's on your mind?",
            "Hi! I'm here to assist you!",
            "Yo! What's good?",
            "Hey! How can I be of service?",
            "Hi there! 😄 How can I help?"
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    } catch (error) {
        console.error('AI Error:', error.message);
        return "I'm here! What would you like to talk about? 😊";
    }
}

// ============================================
// ANTI LINK - WORKS ONLY WHEN BOT IS ADMIN
// ============================================
async function checkAntiLink(conn, msg, body, from, sender, reply, settings) {
    if (!settings.antilink) return false;
    
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return false;
    
    // Check if bot is admin
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const linkPatterns = [
        /chat\.whatsapp\.com\//i,
        /whatsapp\.com\//i,
        /wa\.me\//i,
        /t\.me\//i,
        /telegram\.me\//i,
        /http:\/\//i,
        /https:\/\//i,
        /www\./i
    ];
    
    const hasLink = linkPatterns.some(pattern => pattern.test(body));
    if (!hasLink) return false;
    
    // Get sender info
    const senderName = getUsername(sender);
    
    // Check user warnings
    let warnings = warningTracker.get(sender) || 0;
    warnings += 1;
    warningTracker.set(sender, warnings);
    
    if (warnings >= 3) {
        // Remove user
        try {
            await conn.groupParticipantsUpdate(from, [sender], "remove");
            await reply(`🚫 *USER REMOVED*\n\nUser: @${senderName}\nReason: Sending links (3 warnings)\nAction: Removed from group`);
            warningTracker.delete(sender);
        } catch (e) {
            console.error("Remove error:", e.message);
        }
    } else {
        // Warn user
        await reply(`⚠️ *LINK DETECTED*\n\n@${senderName}, sending links is not allowed!\nWarning: ${warnings}/3\nNext violation will result in removal.`);
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {}
    }
    
    return true;
}

// ============================================
// ANTI PORNO - WORKS ONLY WHEN BOT IS ADMIN
// ============================================
async function checkAntiPorn(conn, msg, body, from, sender, reply, settings) {
    if (!settings.antiporn) return false;
    
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return false;
    
    // Check if bot is admin
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const pornKeywords = config.pornKeywords || [
        'porn', 'sex', 'xxx', 'ngono', 'video za kikubwa', 
        'hentai', 'malaya', 'pussy', 'dick', 'fuck',
        'ass', 'boobs', 'nude', 'nudes', 'nsfw'
    ];
    
    const hasPorn = pornKeywords.some(keyword => 
        body.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasPorn) return false;
    
    const senderName = getUsername(sender);
    
    // Check user warnings
    let warnings = warningTracker.get(sender) || 0;
    warnings += 1;
    warningTracker.set(sender, warnings);
    
    if (warnings >= 2) {
        // Remove user
        try {
            await conn.groupParticipantsUpdate(from, [sender], "remove");
            await reply(`🚫 *USER REMOVED*\n\nUser: @${senderName}\nReason: Pornographic content (2 warnings)\nAction: Removed from group`);
            warningTracker.delete(sender);
        } catch (e) {
            console.error("Remove error:", e.message);
        }
    } else {
        // Warn user
        await reply(`⚠️ *PORN CONTENT DETECTED*\n\n@${senderName}, pornographic content is prohibited!\nWarning: ${warnings}/2\nNext violation will result in removal.`);
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {}
    }
    
    return true;
}

// ============================================
// ANTI SCAM - WORKS ONLY WHEN BOT IS ADMIN
// ============================================
async function checkAntiScam(conn, msg, body, from, sender, reply, settings) {
    if (!settings.antiscam) return false;
    
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return false;
    
    // Check if bot is admin
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const scamKeywords = config.scamKeywords || [
        'investment', 'bitcoin', 'crypto', 'ashinde', 'zawadi', 
        'gift card', 'telegram.me', 'pata pesa', 'ajira',
        'pesa haraka', 'mtaji', 'uwekezaji', 'double money',
        'free money', 'won money', 'won prize', 'lottery'
    ];
    
    const hasScam = scamKeywords.some(keyword => 
        body.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasScam) return false;
    
    const senderName = getUsername(sender);
    
    // Get all group members to tag
    try {
        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants;
        
        let mentionText = "";
        participants.forEach(p => {
            if (p.id !== sender) {
                mentionText += `@${p.id.split('@')[0]} `;
            }
        });
        
        // Warn everyone and remove scammer
        await reply(`🚨 *SCAM ALERT!*\n\n${mentionText}\n\n⚠️ Warning: @${senderName} sent a potential scam message!\nContent: "${body.substring(0, 100)}..."\n\nBe careful of investment scams!`);
        
        // Remove scammer
        await conn.groupParticipantsUpdate(from, [sender], "remove");
        
        // Also delete the message
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {}
        
    } catch (e) {
        console.error("Scam check error:", e.message);
    }
    
    return true;
}

// ============================================
// ANTI MEDIA - WORKS ONLY WHEN BOT IS ADMIN
// ============================================
async function checkAntiMedia(conn, msg, from, sender, reply, settings) {
    if (!settings.antimedia) return false;
    
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return false;
    
    // Check if bot is admin
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    // Check if message has media
    const hasMedia = msg.message?.imageMessage || 
                    msg.message?.videoMessage || 
                    msg.message?.stickerMessage ||
                    msg.message?.audioMessage;
    
    if (!hasMedia) return false;
    
    const senderName = getUsername(sender);
    
    // Warn user
    await reply(`⚠️ *MEDIA NOT ALLOWED*\n\n@${senderName}, sending media is not allowed in this group!\nYour media has been deleted.`);
    
    // Delete the media message
    try {
        await conn.sendMessage(from, { delete: msg.key });
    } catch (e) {}
    
    return true;
}

// ============================================
// ANTI TAG - WORKS ONLY WHEN BOT IS ADMIN
// ============================================
async function checkAntiTag(conn, msg, body, from, sender, reply, settings) {
    if (!settings.antitag) return false;
    
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return false;
    
    // Check if bot is admin
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    // Check for excessive tagging
    const tagCount = (body.match(/@/g) || []).length;
    if (tagCount < 5) return false; // Allow up to 4 tags
    
    const senderName = getUsername(sender);
    
    // Warn user
    await reply(`⚠️ *EXCESSIVE TAGGING*\n\n@${senderName}, please don't tag too many people at once!\nTags detected: ${tagCount}\nMax allowed: 4`);
    
    try {
        await conn.sendMessage(from, { delete: msg.key });
    } catch (e) {}
    
    return true;
}

// ============================================
// ANTI SPAM - WORKS ONLY WHEN BOT IS ADMIN
// ============================================
async function checkAntiSpam(conn, msg, from, sender, settings) {
    if (!settings.antispam) return false;
    
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return false;
    
    // Check if bot is admin
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const now = Date.now();
    const key = `${from}:${sender}`;
    
    if (!spamTracker.has(key)) {
        spamTracker.set(key, {
            count: 1,
            firstMessage: now,
            lastMessage: now
        });
        return false;
    }
    
    const data = spamTracker.get(key);
    data.count++;
    data.lastMessage = now;
    
    const timeDiff = (now - data.firstMessage) / 1000; // seconds
    
    // If more than 10 messages in 30 seconds = spam
    if (data.count > 10 && timeDiff < 30) {
        const reply = createReply(conn, from, msg);
        const senderName = getUsername(sender);
        
        await reply(`🚫 *SPAM DETECTED*\n\n@${senderName} has been muted for 1 hour!\nMessages: ${data.count} in ${Math.round(timeDiff)}s`);
        
        // Mute user for 1 hour
        try {
            await conn.groupParticipantsUpdate(from, [sender], "mute", 3600);
        } catch (e) {
            console.error("Mute error:", e.message);
        }
        
        spamTracker.delete(key);
        return true;
    }
    
    // Clean old entries
    if (timeDiff > 60) {
        spamTracker.delete(key);
    }
    
    return false;
}

// ============================================
// ANTI VIEWONCE
// ============================================
async function handleViewOnce(conn, msg, settings) {
    if (!settings.antiviewonce) return false;
    
    const viewOnceMsg = msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage;
    if (!viewOnceMsg) return false;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    const from = msg.key.remoteJid;
    
    // Get content
    let content = "";
    if (viewOnceMsg.message?.conversation) {
        content = viewOnceMsg.message.conversation;
    } else if (viewOnceMsg.message?.extendedTextMessage?.text) {
        content = viewOnceMsg.message.extendedTextMessage.text;
    } else if (viewOnceMsg.imageMessage) {
        content = "Image (View Once)";
    } else if (viewOnceMsg.videoMessage) {
        content = "Video (View Once)";
    }
    
    // Send to owner
    if (botOwnerJid) {
        const message = `
👁️ *VIEW ONCE MESSAGE*

👤 From: ${getUsername(sender)}
📍 Chat: ${from.endsWith('@g.us') ? 'Group' : 'Private'}
🕐 Time: ${new Date().toLocaleTimeString()}

📝 Content:
${content}`;
        
        await conn.sendMessage(botOwnerJid, { text: message });
    }
    
    return true;
}

// ============================================
// ANTI DELETE
// ============================================
async function handleAntiDelete(conn, msg, settings) {
    if (!settings.antidelete) return false;
    
    // Safely check protocolMessage
    if (!msg.message?.protocolMessage || !msg.message.protocolMessage.key) {
        return false;
    }
    
    const deletedKey = msg.message.protocolMessage.key;
    const messageId = deletedKey.id;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // Get stored content
    const stored = messageStore.get(messageId);
    const content = stored?.content || "Message content not available";
    
    // Send to owner
    if (botOwnerJid) {
        const message = `
🗑️ *DELETED MESSAGE*

👤 From: ${getUsername(sender)}
🕐 Time: ${new Date().toLocaleTimeString()}

📝 Original Content:
${content}`;
        
        await conn.sendMessage(botOwnerJid, { text: message });
        messageStore.delete(messageId);
    }
    
    return true;
}

// ============================================
// AUTO RECORDING
// ============================================
async function handleAutoRecording(conn, msg, settings) {
    if (!settings.autoRecording) return;
    
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        
        // Store message in database
        if (User && User.create) {
            let user = await User.findOne({ jid: sender });
            if (!user) {
                user = await User.create({ 
                    jid: sender,
                    lastActive: new Date(),
                    messageCount: 1
                });
            } else {
                user.messageCount = (user.messageCount || 0) + 1;
                user.lastActive = new Date();
                await user.save();
            }
        }
        
    } catch (error) {
        console.error("Auto recording error:", error.message);
    }
}

// ============================================
// WELCOME & GOODBYE - WORKS ONLY WHEN BOT IS ADMIN
// ============================================
async function handleGroupUpdate(conn, update) {
    try {
        const settings = await Settings.findOne();
        if (!settings?.welcomeGoodbye) return;
        
        const { id, participants, action } = update;
        
        if (action === 'add') {
            for (const participant of participants) {
                await sendWelcomeMessage(conn, id, participant);
            }
        } else if (action === 'remove') {
            for (const participant of participants) {
                await sendGoodbyeMessage(conn, id, participant);
            }
        }
    } catch (error) {
        console.error("Group update error:", error.message);
    }
}

async function sendWelcomeMessage(conn, groupJid, participantJid) {
    try {
        // Check if bot is admin
        const botAdmin = await isBotAdmin(conn, groupJid);
        if (!botAdmin) return;
        
        const groupMetadata = await conn.groupMetadata(groupJid);
        const participantName = getUsername(participantJid);
        
        // Get quote from API
        let quote = "Welcome to our community!";
        try {
            const response = await axios.get('https://api.quotable.io/random');
            if (response.data && response.data.content) {
                quote = response.data.content;
            }
        } catch (e) {}
        
        const welcomeMsg = `
🎉 *WELCOME TO ${groupMetadata.subject?.toUpperCase() || 'THE GROUP'}!*

👤 New Member: @${participantName}
🕐 Joined: ${new Date().toLocaleTimeString()}
📝 Group Description: ${groupMetadata.desc || "No description"}
👥 Total Members: ${groupMetadata.participants?.length || 0}
📊 Active Members: ${groupMetadata.participants?.filter(p => p.admin).length || 0}

💬 *Quote of the day:*
"${quote}"

Enjoy your stay! 🥳`;
        
        await conn.sendMessage(groupJid, { text: welcomeMsg });
    } catch (error) {
        console.error("Welcome error:", error.message);
    }
}

async function sendGoodbyeMessage(conn, groupJid, participantJid) {
    try {
        // Check if bot is admin
        const botAdmin = await isBotAdmin(conn, groupJid);
        if (!botAdmin) return;
        
        const groupMetadata = await conn.groupMetadata(groupJid);
        const participantName = getUsername(participantJid);
        
        const goodbyeMsg = `
👋 *GOODBYE!*

👤 Member: @${participantName}
🕐 Left: ${new Date().toLocaleTimeString()}
👥 Remaining Members: ${groupMetadata.participants?.length || 0}

We'll miss you! 😢`;
        
        await conn.sendMessage(groupJid, { text: goodbyeMsg });
    } catch (error) {
        console.error("Goodbye error:", error.message);
    }
}

// ============================================
// SLEEPING MODE
// ============================================
function isSleepingMode(settings) {
    if (!settings.sleepingMode) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const sleepStart = settings.sleepStart || "22:00";
    const sleepEnd = settings.sleepEnd || "06:00";
    
    const startHour = parseInt(sleepStart.split(':')[0]);
    const startMinute = parseInt(sleepStart.split(':')[1]);
    const endHour = parseInt(sleepEnd.split(':')[0]);
    const endMinute = parseInt(sleepEnd.split(':')[1]);
    
    const startTime = startHour * 100 + startMinute;
    const endTime = endHour * 100 + endMinute;
    
    if (startTime < endTime) {
        return currentTime >= startTime && currentTime < endTime;
    } else {
        return currentTime >= startTime || currentTime < endTime;
    }
}

// ============================================
// COMMAND LOADER - FIXED FOR ALL COMMANDS
// ============================================
async function loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup) {
    try {
        const cmdPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(cmdPath)) {
            const reply = createReply(conn, from, msg);
            await reply("❌ Commands directory not found!");
            return;
        }

        // Find command file
        let commandFile = null;
        const categories = fs.readdirSync(cmdPath);
        
        for (const cat of categories) {
            const catPath = path.join(cmdPath, cat);
            if (!fs.statSync(catPath).isDirectory()) continue;
            
            const files = fs.readdirSync(catPath);
            for (const file of files) {
                if (file === `${command}.js` || file.startsWith(`${command}-`)) {
                    commandFile = path.join(catPath, file);
                    break;
                }
            }
            if (commandFile) break;
        }
        
        if (!commandFile) {
            const reply = createReply(conn, from, msg);
            await reply(`❌ Command "${command}" not found!`);
            return;
        }
        
        // Load command
        delete require.cache[require.resolve(commandFile)];
        const cmdModule = require(commandFile);
        
        // Create reply function
        const reply = createReply(conn, from, msg);
        
        // Check if command requires owner
        if (cmdModule.ownerOnly && !isOwner) {
            await reply("❌ This command is only for bot owner!");
            return;
        }
        
        // FIX: Handle BOTH command formats safely
        if (typeof cmdModule.execute === 'function') {
            // New format with object parameter
            try {
                // Check if function expects object or multiple parameters
                if (cmdModule.execute.length === 1) {
                    // Object parameter format
                    await cmdModule.execute({
                        conn, 
                        msg, 
                        args, 
                        from, 
                        sender, 
                        isGroup, 
                        isOwner, 
                        pushname, 
                        reply, 
                        config
                    });
                } else {
                    // Multiple parameters format (like menu.js)
                    await cmdModule.execute(conn, msg, args, { 
                        from, 
                        reply, 
                        sender, 
                        isOwner, 
                        pushname, 
                        config 
                    });
                }
            } catch (error) {
                console.error(`Command "${command}" execution error:`, error);
                await reply(`❌ Error in "${command}": ${error.message}`);
            }
        } else if (typeof cmdModule === 'function') {
            // Old format function
            try {
                await cmdModule(conn, msg, args, { 
                    from, 
                    reply, 
                    sender, 
                    isOwner, 
                    pushname, 
                    config 
                });
            } catch (error) {
                console.error(`Command "${command}" execution error:`, error);
                await reply(`❌ Error in "${command}": ${error.message}`);
            }
        } else {
            await reply(`❌ Command "${command}" has invalid structure`);
        }
        
    } catch (error) {
        console.error(`Command "${command}" loading error:`, error);
        try {
            const reply = createReply(conn, from, msg);
            await reply(`❌ Error loading "${command}": ${error.message}`);
        } catch (e) {}
    }
}

// ============================================
// MAIN HANDLER - COMPLETE WITH ALL FEATURES
// ============================================
module.exports = async (conn, m) => {
    try {
        if (!m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "User";
        
        // Extract message body SAFELY
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
            }
        } catch (e) {
            body = "";
        }
        
        const isGroup = from.endsWith('@g.us');
        
        // Get settings
        const settings = await Settings.findOne() || {};
        
        // Check sleeping mode
        if (isSleepingMode(settings)) {
            // Only owner can use during sleeping mode
            const isOwner = botOwnerJid ? (sender === botOwnerJid || msg.key.fromMe) : false;
            if (!isOwner) {
                // Send sleeping mode message
                if (isGroup && Math.random() < 0.3) { // 30% chance to reply
                    const reply = createReply(conn, from, msg);
                    await reply("💤 *Sleeping Mode Active*\n\nThe bot is currently sleeping. Please try again later.");
                }
                return;
            }
        }
        
        // Check if it's a command (support both prefix and command without prefix)
        let isCmd = false;
        let command = "";
        let args = [];
        
        if (body && typeof body === 'string') {
            // Check with prefix
            if (body.startsWith(config.prefix)) {
                isCmd = true;
                const cmdText = body.slice(config.prefix.length).trim();
                const parts = cmdText.split(/ +/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
            // Check without prefix for some commands
            else if (config.commandWithoutPrefix) {
                const cmdParts = body.trim().split(/ +/);
                const possibleCmd = cmdParts[0].toLowerCase();
                
                // List of commands that can be used without prefix
                const noPrefixCommands = ['menu', 'help', 'ping', 'owner', 'alive', 'speed'];
                if (noPrefixCommands.includes(possibleCmd)) {
                    isCmd = true;
                    command = possibleCmd;
                    args = cmdParts.slice(1);
                }
            }
        }
        
        // SET BOT OWNER
        if (!botOwnerJid && conn.user) {
            botOwnerJid = conn.user.id;
            console.log(`[OWNER] Bot owner: ${getUsername(botOwnerJid)}`);
        }
        
        // Check if sender is owner
        const isOwner = botOwnerJid ? (sender === botOwnerJid || msg.key.fromMe) : false;
        
        // STORE MESSAGE FOR ANTI DELETE
        if (body && msg.key.id) {
            messageStore.set(msg.key.id, {
                content: body,
                sender: sender,
                timestamp: new Date()
            });
        }
        
        // AUTO RECORDING
        await handleAutoRecording(conn, msg, settings);
        
        // ANTI VIEWONCE
        if (await handleViewOnce(conn, msg, settings)) return;
        
        // ANTI DELETE
        if (await handleAntiDelete(conn, msg, settings)) return;
        
        // AUTO READ
        if (settings.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (e) {}
        }
        
        // AUTO REACT
        if (settings.autoReact && !msg.key.fromMe) {
            try {
                const reactions = ['❤️', '👍', '🔥', '🎉', '👏', '😮', '😂'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                await conn.sendMessage(from, {
                    react: {
                        text: randomReaction,
                        key: msg.key
                    }
                });
            } catch (e) {}
        }
        
        // AUTO SAVE CONTACT
        if (settings.autoSave && !isGroup) {
            try {
                let user = await User.findOne({ jid: sender });
                if (!user) {
                    await User.create({
                        jid: sender,
                        name: pushname,
                        lastActive: new Date(),
                        messageCount: 1
                    });
                }
            } catch (error) {
                console.error("Auto save error:", error.message);
            }
        }
        
        // CHECK ANTI FEATURES (ONLY IN GROUPS)
        if (isGroup && body && !msg.key.fromMe) {
            const reply = createReply(conn, from, msg);
            
            // Anti Link
            if (await checkAntiLink(conn, msg, body, from, sender, reply, settings)) return;
            
            // Anti Porn
            if (await checkAntiPorn(conn, msg, body, from, sender, reply, settings)) return;
            
            // Anti Scam
            if (await checkAntiScam(conn, msg, body, from, sender, reply, settings)) return;
            
            // Anti Media
            if (await checkAntiMedia(conn, msg, from, sender, reply, settings)) return;
            
            // Anti Tag
            if (await checkAntiTag(conn, msg, body, from, sender, reply, settings)) return;
            
            // Anti Spam
            if (await checkAntiSpam(conn, msg, from, sender, settings)) return;
        }
        
        // COMMAND HANDLING - FIXED
        if (isCmd && command) {
            await loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup);
            return;
        }
        
        // AI CHATBOT - REPLY TO EVERYONE (NO SIMULATION)
        if (body && !isCmd && !msg.key.fromMe && settings.chatbot) {
            // Check if message is for bot (contains bot name or is a question)
            const botName = config.botName.toLowerCase();
            const isForBot = body.toLowerCase().includes(botName) || 
                            body.endsWith('?') || 
                            body.toLowerCase().startsWith('hi') ||
                            body.toLowerCase().startsWith('hello') ||
                            body.toLowerCase().startsWith('hey') ||
                            body.toLowerCase().includes('whats up') ||
                            body.toLowerCase().includes('how are you');
            
            if (isForBot) {
                try {
                    // Send typing indicator
                    await conn.sendPresenceUpdate('composing', from);
                    
                    // Get AI response
                    const aiResponse = await getAIResponse(body);
                    
                    // Send response
                    await conn.sendMessage(from, { 
                        text: `💬 *${config.botName}:*\n${aiResponse}` 
                    });
                    
                    // Stop typing
                    await conn.sendPresenceUpdate('paused', from);
                } catch (e) {
                    console.error("Chatbot error:", e.message);
                }
                return;
            }
        }
        
        // UPDATE USER STATS FOR ACTIVE MEMBERS FEATURE
        if (settings.activeMembers && isGroup) {
            try {
                let user = await User.findOne({ jid: sender });
                if (!user) {
                    user = await User.create({
                        jid: sender,
                        name: pushname,
                        lastActive: new Date(),
                        messageCount: 1,
                        isActive: true
                    });
                } else {
                    user.messageCount = (user.messageCount || 0) + 1;
                    user.lastActive = new Date();
                    user.isActive = true;
                    await user.save();
                }
            } catch (error) {
                console.error("Active members error:", error.message);
            }
        }
        
    } catch (err) {
        console.error("Handler Error:", err.message);
    }
};

// ============================================
// GROUP UPDATE HANDLER
// ============================================
module.exports.handleGroupUpdate = async (conn, update) => {
    try {
        const { id, participants, action } = update;
        
        // Handle welcome/goodbye
        await handleGroupUpdate(conn, update);
        
        // Check if bot is admin before taking action
        const botAdmin = await isBotAdmin(conn, id);
        if (!botAdmin) return;
        
        // Anti Call in groups
        const settings = await Settings.findOne();
        if (settings?.anticall) {
            // You can implement anti-call logic here
        }
        
    } catch (error) {
        console.error("Group update handler error:", error.message);
    }
};

// ============================================
// INITIALIZATION
// ============================================
module.exports.init = async (conn) => {
    try {
        console.log('[SYSTEM] Initializing Insidious V2.1.1...');
        
        if (conn.user) {
            botOwnerJid = conn.user.id;
            console.log(`[OWNER] Bot Owner: ${getUsername(botOwnerJid)}`);
            
            // Set auto bio
            const settings = await Settings.findOne();
            if (settings?.autoBio) {
                try {
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    
                    await conn.updateProfileStatus(`🤖 ${config.botName} | 🚀 Online | ⏰ ${hours}h ${minutes}m | 👨‍💻 ${config.developerName}`);
                } catch (e) {
                    console.error("Auto bio error:", e.message);
                }
            }
        }
        
        // Setup scheduled tasks
        setInterval(async () => {
            try {
                // Auto remove inactive members
                if (settings?.activeMembers) {
                    const inactiveDays = 7; // Remove after 7 days inactive
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
                    
                    const inactiveUsers = await User.find({ 
                        lastActive: { $lt: cutoffDate },
                        isActive: true 
                    });
                    
                    for (const user of inactiveUsers) {
                        user.isActive = false;
                        await user.save();
                    }
                    
                    if (inactiveUsers.length > 0) {
                        console.log(`[ACTIVE MEMBERS] Marked ${inactiveUsers.length} users as inactive`);
                    }
                }
            } catch (error) {
                console.error("Scheduled task error:", error.message);
            }
        }, 24 * 60 * 60 * 1000); // Run daily
        
        console.log('[SYSTEM] ✅ Bot initialized with ALL features');
        
    } catch (error) {
        console.error('Init error:', error.message);
    }
};
