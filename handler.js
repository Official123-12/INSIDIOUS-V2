const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');

// IMPORT DATABASE MODELS
let User, Group, ChannelSubscriber, Settings, MessageLog;
try {
    const models = require('./database/models');
    User = models.User;
    Group = models.Group;
    ChannelSubscriber = models.ChannelSubscriber;
    Settings = models.Settings;
    MessageLog = models.MessageLog;
} catch (error) {
    console.log("⚠️ Database models not found, using fallback");
    // Fallback models
    User = { findOne: async () => null, countDocuments: async () => 0, find: async () => [], updateOne: async () => null };
    Group = { findOne: async () => null, countDocuments: async () => 0, find: async () => [], updateOne: async () => null };
    Settings = { 
        findOne: async () => ({ 
            antilink: true, antiporn: true, antiscam: true, antimedia: false, antitag: true,
            antiviewonce: true, antidelete: true, sleepingMode: false, welcomeGoodbye: true,
            chatbot: true, autoRead: true, autoReact: true, autoBio: true, anticall: true,
            antispam: true, antibug: true, autoStatus: true, autoStatusReply: true,
            save: async function() { return this; }
        }) 
    };
    ChannelSubscriber = { findOne: async () => null, countDocuments: async () => 0 };
    MessageLog = { find: async () => [], create: async () => null };
}

// MESSAGE STORE
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

async function getDisplayName(conn, jid) {
    try {
        const user = await User.findOne({ jid: jid });
        if (user && user.name) return user.name;
        
        // Try to get from WhatsApp
        const contact = await conn.getContact(jid);
        return contact?.name || contact?.pushname || getUsername(jid);
    } catch {
        return getUsername(jid);
    }
}

async function getGroupName(conn, groupJid) {
    try {
        const metadata = await conn.groupMetadata(groupJid);
        return metadata.subject || "Group";
    } catch {
        return "Group";
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
// ANTI FEATURES FUNCTIONS
// ============================================

async function checkAntiLink(conn, msg, body, from, sender, isGroup, reply, settings) {
    if (!settings.antilink || !isGroup) return false;
    
    const linkPatterns = [
        /chat\.whatsapp\.com\//i,
        /whatsapp\.com\//i,
        /wa\.me\//i,
        /http:\/\//i,
        /https:\/\//i,
        /www\./i,
        /\.com/i,
        /\.org/i,
        /\.net/i,
        /\.me/i,
        /\.gg/i
    ];
    
    const hasLink = linkPatterns.some(pattern => pattern.test(body));
    if (!hasLink) return false;
    
    // Get user warnings
    let user = await User.findOne({ jid: sender });
    if (!user) {
        user = new User({ jid: sender, warnings: 0 });
    }
    
    user.warnings += 1;
    await user.save();
    
    // Action based on warnings
    if (user.warnings >= 3) {
        // Remove from group
        try {
            await conn.groupParticipantsUpdate(from, [sender], "remove");
            await reply(`🚫 *USER REMOVED*\n\nUser: @${sender.split('@')[0]}\nReason: Sending links (3 warnings)\nTotal Warnings: ${user.warnings}`);
            return true;
        } catch (e) {
            console.error("Remove error:", e.message);
        }
    } else {
        // Warn user
        await reply(`⚠️ *LINK DETECTED*\n\n@${sender.split('@')[0]}, sending links is not allowed!\nWarning: ${user.warnings}/3\nNext violation will result in removal.`);
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {}
        return true;
    }
    return false;
}

async function checkAntiPorn(conn, msg, body, from, sender, isGroup, reply, settings) {
    if (!settings.antiporn || !isGroup) return false;
    
    const pornKeywords = config.pornKeywords || [
        'porn', 'sex', 'xxx', 'ngono', 'video za kikubwa', 
        'hentai', 'malaya', 'pussy', 'dick', 'fuck',
        'ass', 'boobs', 'nude', 'nudes', 'nsfw'
    ];
    
    const hasPorn = pornKeywords.some(keyword => 
        body.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasPorn) return false;
    
    // Get user warnings
    let user = await User.findOne({ jid: sender });
    if (!user) {
        user = new User({ jid: sender, warnings: 0 });
    }
    
    user.warnings += 1;
    await user.save();
    
    // Action based on warnings
    if (user.warnings >= 2) {
        // Remove from group
        try {
            await conn.groupParticipantsUpdate(from, [sender], "remove");
            await reply(`🚫 *USER REMOVED*\n\nUser: @${sender.split('@')[0]}\nReason: Sending pornographic content (2 warnings)\nTotal Warnings: ${user.warnings}`);
            return true;
        } catch (e) {
            console.error("Remove error:", e.message);
        }
    } else {
        // Warn user
        await reply(`⚠️ *PORN CONTENT DETECTED*\n\n@${sender.split('@')[0]}, pornographic content is strictly prohibited!\nWarning: ${user.warnings}/2\nNext violation will result in removal.`);
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {}
        return true;
    }
    return false;
}

async function checkAntiScam(conn, msg, body, from, sender, isGroup, reply, settings) {
    if (!settings.antiscam || !isGroup) return false;
    
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
    
    // Tag all group members and remove scammer
    try {
        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants;
        
        let mentionText = "";
        participants.forEach(participant => {
            mentionText += `@${participant.id.split('@')[0]} `;
        });
        
        await reply(`🚨 *SCAM ALERT!*\n\n${mentionText}\n\n⚠️ Warning: Potential scam detected from @${sender.split('@')[0]}\nMessage: "${body.substring(0, 100)}..."\n\nBe careful of investment scams!`);
        
        // Remove scammer
        await conn.groupParticipantsUpdate(from, [sender], "remove");
        
        return true;
    } catch (e) {
        console.error("Scam check error:", e.message);
    }
    return false;
}

async function checkAntiTag(conn, msg, body, from, sender, isGroup, reply, settings) {
    if (!settings.antitag || !isGroup) return false;
    
    // Check for excessive tagging
    const tagCount = (body.match(/@/g) || []).length;
    if (tagCount < 5) return false; // Allow up to 4 tags
    
    // Warn user
    await reply(`⚠️ *EXCESSIVE TAGGING*\n\n@${sender.split('@')[0]}, please don't tag too many people at once!\nTags detected: ${tagCount}\nMax allowed: 4`);
    
    try {
        await conn.sendMessage(from, { delete: msg.key });
    } catch (e) {}
    
    return true;
}

async function checkAntiSpam(conn, msg, from, sender, isGroup, settings) {
    if (!settings.antispam) return false;
    
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
    
    const timeDiff = (now - data.firstMessage) / 1000; // in seconds
    
    // Check if more than 10 messages in 30 seconds
    if (data.count > 10 && timeDiff < 30) {
        // Spam detected
        spamTracker.delete(key);
        
        try {
            const reply = createReply(conn, from, msg);
            await reply(`🚫 *SPAM DETECTED*\n\nUser @${sender.split('@')[0]} has been muted for spamming.\nMessages: ${data.count} in ${Math.round(timeDiff)}s`);
            
            // Mute user for 1 hour
            await conn.groupParticipantsUpdate(from, [sender], "mute", 3600);
            
            return true;
        } catch (e) {
            console.error("Anti-spam error:", e.message);
        }
    }
    
    // Clean old entries
    if (timeDiff > 60) { // 1 minute
        spamTracker.delete(key);
    }
    
    return false;
}

// ============================================
// POLLINATIONS AI ONLY
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
            "Hey there! 😊 How can I help you?",
            "Hello! I'm here for you!",
            "Hi! What's up?",
            "Yo! What's good?",
            "Hey! How's your day?",
            "Hi there! 😄"
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    } catch (error) {
        console.error('Pollinations AI Error:', error.message);
        return "Hey! I'm here. What's up? 😊";
    }
}

// ============================================
// STORE MESSAGE
// ============================================
function storeMessage(msg) {
    try {
        if (!msg.key || !msg.key.id || msg.key.fromMe) return;
        
        let content = "";
        if (msg.message.conversation) {
            content = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage?.caption) {
            content = msg.message.imageMessage.caption || "";
        } else if (msg.message.videoMessage?.caption) {
            content = msg.message.videoMessage.caption || "";
        }
        
        messageStore.set(msg.key.id, {
            content: content,
            sender: msg.key.participant || msg.key.remoteJid,
            from: msg.key.remoteJid,
            timestamp: new Date()
        });
        
        // Clean old messages
        if (messageStore.size > 500) {
            const keys = Array.from(messageStore.keys()).slice(0, 100);
            keys.forEach(key => messageStore.delete(key));
        }
    } catch (error) {
        // Silent error
    }
}

// ============================================
// ANTI VIEWONCE - SENDS TO OWNER
// ============================================
async function handleViewOnce(conn, msg) {
    try {
        if (!botOwnerJid) return false;
        
        const viewOnceMsg = msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage;
        if (!viewOnceMsg) return false;
        
        const sender = msg.key.participant || msg.key.remoteJid;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
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
        
        // Get group name if group
        let groupInfo = "";
        if (isGroup) {
            try {
                const groupName = await getGroupName(conn, from);
                groupInfo = `📛 Group: ${groupName}\n`;
            } catch (e) {}
        }
        
        // Send to owner
        const message = `
👁️ *VIEW ONCE MESSAGE*

👤 From: ${getUsername(sender)}
${groupInfo}🕐 Time: ${new Date().toLocaleTimeString()}

📝 Content:
${content}

📍 Chat: ${isGroup ? 'Group' : 'Private'}`;
        
        await conn.sendMessage(botOwnerJid, { text: message });
        
        return true;
    } catch (error) {
        console.error("View once error:", error.message);
        return false;
    }
}

// ============================================
// ANTI DELETE - SENDS TO OWNER
// ============================================
async function handleAntiDelete(conn, msg) {
    try {
        if (!botOwnerJid) return false;
        
        if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) {
            return false;
        }
        
        const deletedKey = msg.message.protocolMessage.key;
        const messageId = deletedKey.id;
        const sender = msg.key.participant || msg.key.remoteJid;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        // Get stored content
        const stored = messageStore.get(messageId);
        const content = stored?.content || "Message content not available";
        
        // Get group name if group
        let groupInfo = "";
        if (isGroup) {
            try {
                const groupName = await getGroupName(conn, from);
                groupInfo = `📛 Group: ${groupName}\n`;
            } catch (e) {}
        }
        
        // Send to owner
        const message = `
🗑️ *DELETED MESSAGE*

👤 From: ${getUsername(sender)}
${groupInfo}🕐 Time: ${new Date().toLocaleTimeString()}

📝 Original Content:
${content}

📍 Chat: ${isGroup ? 'Group' : 'Private'}`;
        
        await conn.sendMessage(botOwnerJid, { text: message });
        
        // Clean up
        messageStore.delete(messageId);
        
        return true;
    } catch (error) {
        console.error("Anti delete error:", error.message);
        return false;
    }
}

// ============================================
// WELCOME & GOODBYE
// ============================================
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    try {
        const settings = await Settings.findOne();
        if (!settings?.welcomeGoodbye) return;
        
        const group = await Group.findOne({ jid: groupJid });
        if (!group) return;
        
        const groupMetadata = await conn.groupMetadata(groupJid);
        const participantName = await getDisplayName(conn, participant);
        
        if (action === 'add') {
            // Welcome message
            const welcomeMsg = `
🎉 *WELCOME TO ${groupMetadata.subject.toUpperCase()}!*

👤 New Member: ${participantName}
🕐 Joined: ${new Date().toLocaleTimeString()}
📝 Group Description: ${groupMetadata.desc || "No description"}
👥 Total Members: ${groupMetadata.participants.length}
🌅 Quote: "Every new member is a new chapter in our story!"

Enjoy your stay! 🥳`;
            
            await conn.sendMessage(groupJid, { text: welcomeMsg });
        } else {
            // Goodbye message
            const goodbyeMsg = `
👋 *GOODBYE!*

👤 Member: ${participantName}
🕐 Left: ${new Date().toLocaleTimeString()}
👥 Remaining Members: ${groupMetadata.participants.length}
💔 Quote: "Some chapters end, but the story continues..."

We'll miss you! 😢`;
            
            await conn.sendMessage(groupJid, { text: goodbyeMsg });
        }
    } catch (error) {
        console.error("Welcome/Goodbye error:", error.message);
    }
}

// ============================================
// SIMPLE COMMAND LOADER
// ============================================
async function loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup) {
    try {
        const cmdPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(cmdPath)) {
            fs.ensureDirSync(cmdPath);
            const reply = createReply(conn, from, msg);
            await reply("❌ Commands directory not found! Creating...");
            return;
        }

        // Find command file
        let commandFile = null;
        const categories = fs.readdirSync(cmdPath);
        
        for (const cat of categories) {
            const catPath = path.join(cmdPath, cat);
            if (!fs.statSync(catPath).isDirectory()) continue;
            
            const possibleFile = path.join(catPath, `${command}.js`);
            if (fs.existsSync(possibleFile)) {
                commandFile = possibleFile;
                break;
            }
        }
        
        // Also check root commands
        if (!commandFile) {
            const possibleFile = path.join(cmdPath, `${command}.js`);
            if (fs.existsSync(possibleFile)) {
                commandFile = possibleFile;
            }
        }
        
        if (!commandFile) {
            const reply = createReply(conn, from, msg);
            await reply(`❌ Command "${command}" not found!\nUse ${config.prefix}menu for commands.`);
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
        
        // Check channel subscription
        if (cmdModule.requiresChannel) {
            const isSubscribed = await ChannelSubscriber.findOne({ jid: sender });
            if (!isSubscribed) {
                await reply(`📢 Please follow our channel first!\nChannel: ${config.channelLink}`);
                return;
            }
        }
        
        // Execute command based on format
        if (typeof cmdModule.execute === 'function') {
            // New format
            await cmdModule.execute({
                conn, msg, args, from, sender, isGroup, isOwner, pushname, reply, config
            });
        } else if (typeof cmdModule === 'function') {
            // Old format
            await cmdModule(conn, msg, args, { from, reply, sender, isOwner, pushname, config });
        } else {
            await reply(`❌ Invalid command structure for "${command}"`);
        }
        
    } catch (error) {
        console.error(`Command "${command}" error:`, error);
        try {
            const reply = createReply(conn, from, msg);
            await reply(`❌ Error in "${command}": ${error.message}`);
        } catch (e) {}
    }
}

// ============================================
// CHATBOT - REPLIES TO EVERYONE
// ============================================
async function handleChatbot(conn, from, body, pushname, settings) {
    try {
        if (!settings?.chatbot) return false;
        if (!body || body.trim().length < 1) return false;
        
        // Check if message is for bot (starts with bot name or is a question)
        const botName = config.botName.toLowerCase();
        const isForBot = body.toLowerCase().includes(botName) || 
                        body.endsWith('?') || 
                        body.toLowerCase().startsWith('hi') ||
                        body.toLowerCase().startsWith('hello') ||
                        body.toLowerCase().startsWith('hey');
        
        if (!isForBot) return false;
        
        // Typing indicator
        try {
            await conn.sendPresenceUpdate('composing', from);
        } catch (e) {}
        
        // Get AI response
        const aiResponse = await getAIResponse(body);
        
        // Send response
        await conn.sendMessage(from, { 
            text: `💬 ${aiResponse}` 
        });
        
        // Stop typing
        try {
            await conn.sendPresenceUpdate('paused', from);
        } catch (e) {}
        
        return true;
    } catch (error) {
        console.error("Chatbot error:", error.message);
        return false;
    }
}

// ============================================
// AUTO REACT TO MESSAGES
// ============================================
async function handleAutoReact(conn, msg, from, sender, settings) {
    if (!settings?.autoReact) return;
    
    try {
        const reactions = ['❤️', '👍', '🔥', '🎉', '👏', '😂', '😮', '😢'];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        
        await conn.sendMessage(from, {
            react: {
                text: randomReaction,
                key: msg.key
            }
        });
    } catch (error) {
        console.error("Auto react error:", error.message);
    }
}

// ============================================
// MAIN HANDLER - COMPLETE
// ============================================
module.exports = async (conn, m) => {
    try {
        if (!m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "User";
        
        // Extract message body
        let body = "";
        if (msg.message.conversation) {
            body = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
            body = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage?.caption) {
            body = msg.message.imageMessage.caption || "";
        } else if (msg.message.videoMessage?.caption) {
            body = msg.message.videoMessage.caption || "";
        }
        
        const isGroup = from.endsWith('@g.us');
        const isCmd = body && (body.startsWith(config.prefix) || 
                             (!config.prefix && body.startsWith('.')) ||
                             body.startsWith(config.botName.toLowerCase()));
        const command = isCmd ? body.replace(config.prefix, '').trim().split(' ')[0].toLowerCase() : '';
        const args = isCmd ? body.trim().split(/ +/).slice(1) : [];
        
        // SET BOT OWNER
        if (!botOwnerJid && conn.user) {
            botOwnerJid = conn.user.id;
            console.log(`[OWNER] Bot owner: ${getUsername(botOwnerJid)}`);
        }
        
        // Check if sender is owner
        const isOwner = botOwnerJid ? (sender === botOwnerJid || msg.key.fromMe) : false;
        
        // GET SETTINGS
        const settings = await Settings.findOne() || {};
        
        // STORE MESSAGE
        storeMessage(msg);
        
        // ANTI VIEWONCE
        if (settings.antiviewonce) {
            if (await handleViewOnce(conn, msg)) return;
        }
        
        // ANTI DELETE
        if (settings.antidelete) {
            if (await handleAntiDelete(conn, msg)) return;
        }
        
        // AUTO READ
        if (settings.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (e) {}
        }
        
        // AUTO REACT
        await handleAutoReact(conn, msg, from, sender, settings);
        
        // CHECK FOR GROUP EVENTS
        if (msg.message?.protocolMessage) {
            const protocolMsg = msg.message.protocolMessage;
            
            // Handle group participants update
            if (protocolMessage.type === 4) { // add
                const participants = protocolMessage.participants || [];
                participants.forEach(async (participant) => {
                    await handleWelcome(conn, participant, from, 'add');
                });
            } else if (protocolMessage.type === 3) { // remove
                const participants = protocolMessage.participants || [];
                participants.forEach(async (participant) => {
                    await handleWelcome(conn, participant, from, 'remove');
                });
            }
        }
        
        // ANTI FEATURES CHECK
        if (isGroup && body) {
            const reply = createReply(conn, from, msg);
            
            // Check anti-link
            if (await checkAntiLink(conn, msg, body, from, sender, isGroup, reply, settings)) return;
            
            // Check anti-porn
            if (await checkAntiPorn(conn, msg, body, from, sender, isGroup, reply, settings)) return;
            
            // Check anti-scam
            if (await checkAntiScam(conn, msg, body, from, sender, isGroup, reply, settings)) return;
            
            // Check anti-tag
            if (await checkAntiTag(conn, msg, body, from, sender, isGroup, reply, settings)) return;
            
            // Check anti-spam
            if (await checkAntiSpam(conn, msg, from, sender, isGroup, settings)) return;
        }
        
        // COMMAND HANDLING
        if (isCmd && command) {
            await loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup);
            return;
        }
        
        // CHATBOT
        if (body && body.trim().length > 0 && !isCmd && !msg.key.fromMe) {
            if (await handleChatbot(conn, from, body, pushname, settings)) {
                return;
            }
        }
        
        // UPDATE USER STATS
        try {
            let user = await User.findOne({ jid: sender });
            if (!user) {
                user = new User({ 
                    jid: sender, 
                    name: pushname,
                    messageCount: 1,
                    lastActive: new Date()
                });
            } else {
                user.messageCount = (user.messageCount || 0) + 1;
                user.lastActive = new Date();
                user.name = pushname || user.name;
            }
            await user.save();
        } catch (e) {
            console.error("User update error:", e.message);
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
        console.log('[SYSTEM] Initializing Insidious V2.1.1...');
        
        if (conn.user) {
            botOwnerJid = conn.user.id;
            console.log(`[OWNER] Bot Owner: ${getUsername(botOwnerJid)}`);
            
            // Set auto bio if enabled
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
        
        // Schedule auto tasks
        const scheduleTasks = () => {
            // Clean old messages every hour
            setInterval(() => {
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                
                for (const [key, value] of messageStore.entries()) {
                    if (now - value.timestamp.getTime() > oneHour) {
                        messageStore.delete(key);
                    }
                }
            }, 3600000);
            
            // Check inactive members daily
            setInterval(async () => {
                try {
                    const settings = await Settings.findOne();
                    if (!settings?.activeMembers) return;
                    
                    const inactiveDays = settings.inactiveDays || 7;
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
                    
                    const inactiveUsers = await User.find({ 
                        lastActive: { $lt: cutoffDate },
                        isActive: true 
                    });
                    
                    for (const user of inactiveUsers) {
                        user.isActive = false;
                        await user.save();
                        
                        // Notify owner
                        if (botOwnerJid) {
                            await conn.sendMessage(botOwnerJid, {
                                text: `👤 User ${user.name || user.jid} marked as inactive\nLast active: ${user.lastActive}`
                            });
                        }
                    }
                    
                } catch (error) {
                    console.error("Inactive check error:", error.message);
                }
            }, 86400000); // 24 hours
        };
        
        scheduleTasks();
        
        console.log('[SYSTEM] ✅ Bot initialized successfully');
        
    } catch (error) {
        console.error('Init error:', error.message);
    }
};
