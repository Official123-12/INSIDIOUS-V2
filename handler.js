const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');

// LOAD DATABASE MODELS
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
const mediaStore = new Map();

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

async function isBotAdmin(conn, groupJid, participantJid) {
    try {
        if (!participantJid) {
            participantJid = conn.user?.id;
        }
        if (!participantJid || !groupJid) return false;
        
        const metadata = await conn.groupMetadata(groupJid);
        const participant = metadata.participants.find(p => p.id === participantJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch {
        return false;
    }
}

async function getGroupAdmins(conn, groupJid) {
    try {
        const metadata = await conn.groupMetadata(groupJid);
        return metadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);
    } catch {
        return [];
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
        const from = msg.key.remoteJid;
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
        
        // Store in memory for quick access
        mediaStore.set(msg.key.id, {
            jid: sender,
            timestamp: new Date(),
            type: msg.message?.imageMessage ? 'image' : 
                  msg.message?.videoMessage ? 'video' :
                  msg.message?.audioMessage ? 'audio' : 'text'
        });
        
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
        
        // Check for group participants update
        if (update.type === 'add') {
            const participants = update.participants || [];
            for (const participant of participants) {
                await sendWelcomeMessage(conn, update.id, participant);
            }
        } else if (update.type === 'remove') {
            const participants = update.participants || [];
            for (const participant of participants) {
                await sendGoodbyeMessage(conn, update.id, participant);
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
        
        const welcomeMsg = `
🎉 *WELCOME TO ${groupMetadata.subject.toUpperCase()}!*

👤 New Member: @${participantName}
🕐 Joined: ${new Date().toLocaleTimeString()}
📝 Group Description: ${groupMetadata.desc || "No description"}
👥 Total Members: ${groupMetadata.participants.length}

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
👥 Remaining Members: ${groupMetadata.participants.length}

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
// ACTIVE MEMBERS TRACKING
// ============================================
async function trackActiveMembers(conn, msg, sender) {
    try {
        const settings = await Settings.findOne();
        if (!settings?.activeMembers) return;
        
        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        if (!isGroup) return;
        
        let user = await User.findOne({ jid: sender });
        if (!user) {
            user = await User.create({
                jid: sender,
                messageCount: 1,
                lastActive: new Date()
            });
        } else {
            user.messageCount = (user.messageCount || 0) + 1;
            user.lastActive = new Date();
            await user.save();
        }
        
        // Update group stats
        const group = await Group.findOne({ jid: msg.key.remoteJid });
        if (group) {
            group.messageStats = group.messageStats || { total: 0, active: 0 };
            group.messageStats.total = (group.messageStats.total || 0) + 1;
            await group.save();
        }
        
    } catch (error) {
        console.error("Active members tracking error:", error.message);
    }
}

// ============================================
// AUTO SAVE CONTACT
// ============================================
async function handleAutoSave(conn, msg, settings) {
    if (!settings.autoSave) return;
    
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        
        // Check if contact already exists
        const existingUser = await User.findOne({ jid: sender });
        if (!existingUser) {
            await User.create({
                jid: sender,
                name: msg.pushName || "Unknown",
                lastActive: new Date(),
                messageCount: 1
            });
        }
    } catch (error) {
        console.error("Auto save error:", error.message);
    }
}

// ============================================
// COMMAND LOADER - FIXED
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
        
        // Execute command
        if (typeof cmdModule.execute === 'function') {
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
        } else if (typeof cmdModule === 'function') {
            await cmdModule(conn, msg, args, { 
                from, 
                reply, 
                sender, 
                isOwner, 
                pushname, 
                config 
            });
        } else {
            await reply(`❌ Command "${command}" has invalid structure`);
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
            if (!isOwner) return;
        }
        
        // Check if it's a command
        let isCmd = false;
        let command = "";
        let args = [];
        
        if (body && typeof body === 'string') {
            if (body.startsWith(config.prefix)) {
                isCmd = true;
                const cmdText = body.slice(config.prefix.length).trim();
                const parts = cmdText.split(/ +/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
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
        if (body) {
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
                const reactions = ['❤️', '👍', '🔥', '🎉'];
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
        await handleAutoSave(conn, msg, settings);
        
        // TRACK ACTIVE MEMBERS
        await trackActiveMembers(conn, msg, sender);
        
        // CHECK ANTI FEATURES (ONLY IN GROUPS)
        if (isGroup && body) {
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
        
        // COMMAND HANDLING
        if (isCmd && command) {
            await loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup);
            return;
        }
        
        // CHATBOT (Simple response)
        if (body && !isCmd && !msg.key.fromMe && settings.chatbot) {
            const botName = config.botName.toLowerCase();
            if (body.toLowerCase().includes(botName) || body.endsWith('?')) {
                try {
                    await conn.sendPresenceUpdate('composing', from);
                    
                    // Simple AI responses
                    const responses = [
                        "Hello! How can I help you? 😊",
                        "Hey there! What's up?",
                        "Hi! I'm here to help!",
                        "Yo! Need something?",
                        "Hello! How's your day going?"
                    ];
                    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                    
                    await conn.sendMessage(from, { text: randomResponse });
                    await conn.sendPresenceUpdate('paused', from);
                } catch (e) {}
            }
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
                } catch (e) {}
            }
        }
        
        // Setup group update listener
        conn.ev.on('group-participants.update', async (update) => {
            await handleGroupUpdate(conn, update);
        });
        
        console.log('[SYSTEM] ✅ Bot initialized with all features');
        
    } catch (error) {
        console.error('Init error:', error.message);
    }
};
