const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');

// DATABASE MODELS (WITH FALLBACK)
let User, Group, ChannelSubscriber, Settings;
try {
    const models = require('./database/models');
    User = models.User;
    Group = models.Group;
    ChannelSubscriber = models.ChannelSubscriber;
    Settings = models.Settings;
} catch (error) {
    console.log(fancy("⚠️  Using mock database models"));
    // Mock models if database not available
    User = { findOne: () => Promise.resolve(null), countDocuments: () => Promise.resolve(0), find: () => Promise.resolve([]), create: () => Promise.resolve({}) };
    Group = { findOne: () => Promise.resolve(null), countDocuments: () => Promise.resolve(0) };
    ChannelSubscriber = { findOne: () => Promise.resolve(null), countDocuments: () => Promise.resolve(0), find: () => Promise.resolve([]), create: () => Promise.resolve({}), findOneAndUpdate: () => Promise.resolve({}) };
    Settings = { findOne: () => Promise.resolve(null), create: () => Promise.resolve({}) };
}

// ============================================
// GLOBAL VARIABLES
// ============================================
let sessionSyncRunning = false;
let lastSessionSync = 0;
let botOwnerJid = null;

// ============================================
// FEATURE CONFIGURATIONS
// ============================================
const blockedCountries = config.blockedCountries || [];
const scamKeywords = config.scamKeywords || ['scam', 'fraud', 'cheat', 'trick'];
const antimediaTypes = config.antimediaTypes || 'all'; // all, photo, video, sticker, gif
const channelJid = "120363404317544295@newsletter";
const groupJid = "120363406549688641@g.us";

// ============================================
// GET BOT OWNER (NUMBER ILIYOLINK BOT)
// ============================================
function getBotOwner(conn) {
    try {
        if (conn.user && conn.user.id) {
            const ownerNumber = conn.user.id.split(':')[0].split('@')[0];
            return ownerNumber + '@s.whatsapp.net';
        }
    } catch (error) {
        console.error('Error getting bot owner:', error.message);
    }
    return null;
}

// ============================================
// CLEAR COMMAND CACHE
// ============================================
function clearCommandCache() {
    try {
        const cmdPath = path.join(__dirname, 'commands');
        if (fs.existsSync(cmdPath)) {
            const categories = fs.readdirSync(cmdPath);
            for (const cat of categories) {
                const categoryPath = path.join(cmdPath, cat);
                if (fs.statSync(categoryPath).isDirectory()) {
                    const files = fs.readdirSync(categoryPath);
                    files.forEach(file => {
                        if (file.endsWith('.js')) {
                            const fullPath = path.join(categoryPath, file);
                            if (require.cache[fullPath]) {
                                delete require.cache[require.resolve(fullPath)];
                            }
                        }
                    });
                }
            }
        }
        console.log(fancy('[CACHE] ✅ Cleared command cache'));
    } catch (error) {
        console.error('Clear cache error:', error.message);
    }
}

// ============================================
// CREATE REPLY FUNCTION (FAST RESPONSE)
// ============================================
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
            console.error('Reply function error:', error.message);
            return null;
        }
    };
}

// ============================================
// CREATE MSG WITH REPLY
// ============================================
function createMsgWithReply(conn, from, originalMsg) {
    const replyFn = createReplyFunction(conn, from, originalMsg);
    return {
        ...originalMsg,
        reply: replyFn
    };
}

// ============================================
// LOAD COMMAND FUNCTION (FAST)
// ============================================
async function loadCommand(command, conn, from, msg, args, settings, isOwner, sender, pushname) {
    try {
        const cmdPath = path.join(__dirname, 'commands');
        
        if (!fs.existsSync(cmdPath)) {
            await conn.sendMessage(from, {
                text: fancy('❌ Commands directory not found!')
            });
            return;
        }

        const categories = fs.readdirSync(cmdPath);
        let commandFound = false;
        
        for (const cat of categories) {
            const categoryPath = path.join(cmdPath, cat);
            if (!fs.statSync(categoryPath).isDirectory()) continue;

            const commandFile = path.join(categoryPath, `${command}.js`);
            
            if (fs.existsSync(commandFile)) {
                commandFound = true;
                try {
                    // Clear cache for this command
                    if (require.cache[commandFile]) {
                        delete require.cache[require.resolve(commandFile)];
                    }
                    
                    // Load command module
                    const cmdModule = require(commandFile);
                    
                    // Create reply function
                    const reply = createReplyFunction(conn, from, msg);
                    
                    // Create msg with reply
                    const msgWithReply = createMsgWithReply(conn, from, msg);
                    
                    // Create context object
                    const context = {
                        from: from,
                        sender: sender,
                        isGroup: from.endsWith('@g.us'),
                        isOwner: isOwner,
                        pushname: pushname || 'User',
                        fancy: fancy,
                        config: config,
                        settings: settings,
                        conn: conn,
                        msg: msgWithReply,
                        args: args,
                        reply: reply
                    };

                    // Check command structure and execute
                    if (cmdModule.execute && cmdModule.execute.length >= 4) {
                        const extraParams = {
                            from: from,
                            sender: sender,
                            isGroup: from.endsWith('@g.us'),
                            isOwner: isOwner,
                            pushname: pushname || 'User',
                            fancy: fancy,
                            config: config,
                            settings: settings,
                            reply: reply
                        };
                        
                        await cmdModule.execute(conn, msgWithReply, args, extraParams);
                    }
                    else if (typeof cmdModule.execute === 'function') {
                        await cmdModule.execute(context);
                    } else if (typeof cmdModule === 'function') {
                        await cmdModule(context);
                    } else if (cmdModule.default && typeof cmdModule.default === 'function') {
                        await cmdModule.default(context);
                    } else {
                        await reply(`❌ Command "${command}" has invalid structure`);
                    }
                    
                    return;
                    
                } catch (err) {
                    console.error(`Command "${command}" execution error:`, err);
                    const errorReply = createReplyFunction(conn, from, msg);
                    await errorReply(fancy(`❌ Error in "${command}": ${err.message}`));
                    return;
                }
            }
        }
        
        // Command not found
        if (!commandFound) {
            const reply = createReplyFunction(conn, from, msg);
            await reply(fancy(`❌ Command "${command}" not found!\nUse ${config.prefix || '!'}menu for commands.`));
        }
        
    } catch (error) {
        console.error('Load command error:', error);
    }
}

// ============================================
// AUTO FOLLOW ALL USERS TO CHANNEL (FAST) - ALL USERS INCLUDING OLD 2024
// ============================================
async function autoFollowAllUsers(conn) {
    try {
        console.log(fancy('[CHANNEL] ⚡ Auto-following ALL users (including old 2024 sessions)...'));
        
        let allUsers = [];
        try {
            // Get ALL users from database, no date restriction
            allUsers = await User.find({});
            console.log(fancy(`[CHANNEL] 📊 Found ${allUsers.length} total users in database`));
        } catch (e) {
            console.log(fancy('[CHANNEL] ❌ Error fetching users from database'));
            return 0;
        }
        
        let followedCount = 0;
        let skippedCount = 0;
        
        for (const user of allUsers) {
            try {
                if (!user.jid) {
                    skippedCount++;
                    continue;
                }
                
                // Check if already subscribed
                const existing = await ChannelSubscriber.findOne({ jid: user.jid });
                
                if (!existing) {
                    await ChannelSubscriber.create({
                        jid: user.jid,
                        name: user.name || 'User',
                        subscribedAt: new Date(),
                        isActive: true,
                        autoFollow: true,
                        lastActive: user.lastActive || new Date(),
                        source: 'auto-follow-all-historic'
                    });
                    followedCount++;
                    console.log(fancy(`[CHANNEL] ✅ Followed: ${user.jid.split('@')[0]}`));
                } else {
                    // Update existing subscription to active
                    await ChannelSubscriber.findOneAndUpdate(
                        { jid: user.jid },
                        { 
                            isActive: true,
                            lastActive: new Date(),
                            autoFollow: true 
                        }
                    );
                    skippedCount++;
                }
            } catch (userErr) {
                console.error(`[CHANNEL] ❌ Error following user ${user.jid}:`, userErr.message);
            }
        }
        
        console.log(fancy(`[CHANNEL] 📈 Auto-followed ${followedCount} new users, ${skippedCount} already followed`));
        
        // Also follow bot owner if not already followed
        if (botOwnerJid) {
            try {
                const ownerExists = await ChannelSubscriber.findOne({ jid: botOwnerJid });
                if (!ownerExists) {
                    await ChannelSubscriber.create({
                        jid: botOwnerJid,
                        name: 'Bot Owner',
                        subscribedAt: new Date(),
                        isActive: true,
                        autoFollow: true,
                        lastActive: new Date(),
                        source: 'owner-auto-follow'
                    });
                    console.log(fancy(`[CHANNEL] 👑 Owner auto-followed to channel`));
                }
            } catch (e) {
                console.error('[CHANNEL] Error following owner:', e.message);
            }
        }
        
        return followedCount;
    } catch (error) {
        console.error('Auto-follow error:', error.message);
        return 0;
    }
}

// ============================================
// AUTO REACT TO CHANNEL POSTS (FAST) - BOT REACTS TO EVERY POST
// ============================================
async function handleChannelAutoReact(conn, msg) {
    try {
        if (!msg.message || !msg.key) return false;
        
        const from = msg.key.remoteJid;
        
        // Check if message is from the specified channel
        if (from !== channelJid) return false;
        
        console.log(fancy(`[CHANNEL REACT] 📢 New post detected in channel`));
        
        // Get settings for auto react
        let autoReactEnabled = true;
        try {
            const settings = await Settings.findOne();
            autoReactEnabled = settings?.autoReactChannel ?? true;
        } catch (e) {
            autoReactEnabled = true;
        }
        
        if (!autoReactEnabled) return false;
        
        // Channel reactions
        const channelReactions = config.channelReactions || ['❤️', '🔥', '⭐', '👍', '🎉', '👏', '💯', '🙌'];
        const randomReaction = channelReactions[Math.floor(Math.random() * channelReactions.length)];
        
        // Auto react to channel post
        await conn.sendMessage(from, {
            react: {
                text: randomReaction,
                key: msg.key
            }
        });
        
        console.log(fancy(`[CHANNEL REACT] ✅ Reacted with: ${randomReaction}`));
        
        // Also send view receipt (mark as seen)
        try {
            await conn.readMessages([msg.key]);
        } catch (readError) {}
        
        return true;
    } catch (error) {
        console.error("Channel auto-react error:", error.message);
        return false;
    }
}

// ============================================
// SESSION SYNC WITH CHANNEL (FAST) - ALL USERS NO DATE RESTRICTION
// ============================================
async function syncSessionsWithChannel(conn) {
    if (sessionSyncRunning) return 0;
    sessionSyncRunning = true;
    
    try {
        console.log(fancy('[SYNC] 🔄 Syncing ALL sessions with channel...'));
        
        let allUsers = [];
        let activeSubscribers = [];
        
        try {
            // Get ALL users, no date restriction
            allUsers = await User.find({});
            activeSubscribers = await ChannelSubscriber.find({ isActive: true });
        } catch (e) {
            console.error('[SYNC] Database error:', e.message);
            return 0;
        }
        
        const subscribedJids = activeSubscribers.map(sub => sub.jid);
        const usersToSubscribe = allUsers.filter(user => !subscribedJids.includes(user.jid));
        
        let syncedCount = 0;
        
        for (const user of usersToSubscribe) {
            try {
                await ChannelSubscriber.findOneAndUpdate(
                    { jid: user.jid },
                    {
                        jid: user.jid,
                        name: user.name || 'Unknown',
                        subscribedAt: new Date(),
                        isActive: true,
                        autoFollow: true,
                        lastActive: user.lastActive || new Date(),
                        source: 'sync-all-sessions'
                    },
                    { upsert: true, new: true }
                );
                syncedCount++;
            } catch (err) {
                console.error(`[SYNC] Error syncing user ${user.jid}:`, err.message);
            }
        }
        
        if (syncedCount > 0) {
            console.log(fancy(`[SYNC] ✅ Synced ${syncedCount} sessions with channel`));
        } else {
            console.log(fancy(`[SYNC] ✅ All sessions already synced with channel`));
        }
        
        return syncedCount;
    } catch (error) {
        console.error('Session sync error:', error.message);
        return 0;
    } finally {
        sessionSyncRunning = false;
    }
}

// ============================================
// ANTI-VIEW ONCE HANDLER (SILENT & FAST)
// ============================================
async function handleViewOnce(conn, msg, sender) {
    try {
        if (msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage) {
            const viewOnceMsg = msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage;
            
            if (!botOwnerJid) return false;
            
            // Get settings
            let antiviewonceEnabled = true;
            try {
                const settings = await Settings.findOne();
                antiviewonceEnabled = settings?.antiviewonce ?? true;
            } catch (e) {}
            
            if (!antiviewonceEnabled) return false;
            
            await conn.sendMessage(botOwnerJid, {
                text: fancy(`👁️ *VIEW ONCE DETECTED*\n\nFrom: ${sender}\nTime: ${new Date().toLocaleString()}\n\nMessage was deleted after viewing.`)
            });
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-DELETE HANDLER (SILENT & FAST)
// ============================================
async function handleAntiDelete(conn, msg, from, sender) {
    try {
        if (msg.message?.protocolMessage?.type === 5) {
            const deletedMsgKey = msg.message.protocolMessage.key;
            
            if (!botOwnerJid) return false;
            
            // Get settings
            let antideleteEnabled = true;
            try {
                const settings = await Settings.findOne();
                antideleteEnabled = settings?.antidelete ?? true;
            } catch (e) {}
            
            if (!antideleteEnabled) return false;
            
            await conn.sendMessage(botOwnerJid, {
                text: fancy(`🗑️ *DELETED MESSAGE*\n\nFrom: ${sender}\nGroup: ${from}\nTime: ${new Date().toLocaleString()}\n\nMessage was deleted by sender.`)
            });
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-LINK HANDLER
// ============================================
async function handleAntiLink(conn, msg, from, sender, body, settings) {
    try {
        if (!settings.antilink) return false;
        
        // Check for URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const hasLink = urlRegex.test(body);
        
        if (hasLink) {
            // Delete the message
            await conn.sendMessage(from, { delete: msg.key });
            
            // Warn the user
            await conn.sendMessage(from, {
                text: fancy(`⚠️ *LINK DETECTED*\n\n@${sender.split('@')[0]}, Links are not allowed in this group!\n\nAction: Message deleted${settings.antilinkAction === 'remove' ? ' and user removed' : settings.antilinkAction === 'warn' ? ' and warning issued' : ''}`),
                mentions: [sender]
            });
            
            // Take action based on settings
            if (settings.antilinkAction === 'remove') {
                await conn.groupParticipantsUpdate(from, [sender], 'remove');
            }
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-SCAM HANDLER
// ============================================
async function handleAntiScam(conn, msg, from, sender, body, settings) {
    try {
        if (!settings.antiscam) return false;
        
        const lowerBody = body.toLowerCase();
        const isScam = scamKeywords.some(keyword => lowerBody.includes(keyword));
        
        if (isScam) {
            // Delete the message
            await conn.sendMessage(from, { delete: msg.key });
            
            // Tag all members and warn
            const metadata = await conn.groupMetadata(from);
            const mentions = metadata.participants.map(p => p.id);
            
            await conn.sendMessage(from, {
                text: fancy(`🚨 *SCAM ALERT*\n\n@${sender.split('@')[0]} sent a potential scam message!\n\n⚠️ *WARNING:* Be careful with this user!\n\nMessage has been deleted for safety.`),
                mentions: [sender, ...mentions]
            });
            
            // Remove the scammer
            await conn.groupParticipantsUpdate(from, [sender], 'remove');
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-MEDIA HANDLER
// ============================================
async function handleAntiMedia(conn, msg, from, sender, settings) {
    try {
        if (settings.antimedia === 'off') return false;
        
        const msgType = Object.keys(msg.message)[0];
        let shouldBlock = false;
        
        if (settings.antimedia === 'all') {
            shouldBlock = ['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage'].includes(msgType);
        } else if (Array.isArray(settings.antimedia)) {
            shouldBlock = settings.antimedia.some(type => msgType.includes(type));
        }
        
        if (shouldBlock) {
            // Delete the message
            await conn.sendMessage(from, { delete: msg.key });
            
            // Warn the user
            await conn.sendMessage(from, {
                text: fancy(`📵 *MEDIA NOT ALLOWED*\n\n@${sender.split('@')[0]}, Media sharing is restricted in this group!\n\nYour ${msgType.replace('Message', '')} has been deleted.`),
                mentions: [sender]
            });
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-TAG HANDLER
// ============================================
async function handleAntiTag(conn, msg, from, sender, body, settings) {
    try {
        if (!settings.antitag) return false;
        
        // Check for @mentions or tags
        const tagRegex = /@[0-9]{10,}/g;
        const tags = body.match(tagRegex);
        
        if (tags && tags.length > 3) { // More than 3 tags
            // Delete the message
            await conn.sendMessage(from, { delete: msg.key });
            
            // Warn the user
            await conn.sendMessage(from, {
                text: fancy(`🏷️ *EXCESSIVE TAGGING*\n\n@${sender.split('@')[0]}, You tagged too many people!\n\nMaximum allowed: 3 tags per message\nYour tags: ${tags.length}`),
                mentions: [sender]
            });
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-SPAM HANDLER
// ============================================
async function handleAntiSpam(conn, msg, from, sender, body, settings) {
    try {
        if (!settings.antispam) return false;
        
        // Simple spam detection
        const repeatedChars = /(.)\1{10,}/; // Same character repeated 10+ times
        const allCaps = /^[A-Z\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{20,}$/; // All caps long message
        
        if (repeatedChars.test(body) || allCaps.test(body)) {
            // Delete the message
            await conn.sendMessage(from, { delete: msg.key });
            
            // Warn the user
            await conn.sendMessage(from, {
                text: fancy(`🚫 *SPAM DETECTED*\n\n@${sender.split('@')[0]}, Your message was flagged as spam!\n\nPlease avoid sending spam messages.`),
                mentions: [sender]
            });
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-BUGS HANDLER (SAFE VERSION - NO DESTRUCTIVE)
// ============================================
async function handleAntiBugs(conn, msg, from, sender, body, settings) {
    try {
        if (!settings.antibug) return false;
        
        // Check for bug emojis or keywords
        const bugKeywords = ['bug', 'virus', 'malware', 'hack', 'crash'];
        const lowerBody = body.toLowerCase();
        const isBug = bugKeywords.some(keyword => lowerBody.includes(keyword));
        
        if (isBug) {
            // Delete the message
            await conn.sendMessage(from, { delete: msg.key });
            
            // Warn the user
            await conn.sendMessage(from, {
                text: fancy(`🐛 *BUG ATTACK DETECTED*\n\n@${sender.split('@')[0]}, Bug attacks are not allowed!\n\nYour message has been deleted.`),
                mentions: [sender]
            });
            
            // Report to owner (NO BLOCKING, JUST REPORT)
            if (botOwnerJid) {
                await conn.sendMessage(botOwnerJid, {
                    text: fancy(`🐛 *BUG ATTACK ATTEMPT*\n\nFrom: ${sender}\nGroup: ${from}\nMessage: ${body.substring(0, 100)}...\n\nMessage deleted, user warned.`)
                });
            }
            
            return true;
        }
    } catch (e) {}
    return false;
}

// ============================================
// AUTO BLOCK COUNTRY NUMBERS
// ============================================
async function handleAutoBlockCountry(conn, sender) {
    try {
        if (!blockedCountries.length) return false;
        
        const phoneNumber = sender.split('@')[0];
        
        for (const countryCode of blockedCountries) {
            if (phoneNumber.startsWith(countryCode)) {
                // Block the number
                await conn.updateBlockStatus(sender, 'block');
                
                console.log(fancy(`[AUTO-BLOCK] ❌ Blocked ${phoneNumber} (Country: ${countryCode})`));
                
                // Notify owner
                if (botOwnerJid) {
                    await conn.sendMessage(botOwnerJid, {
                        text: fancy(`🚫 *AUTO-BLOCKED*\n\nNumber: ${phoneNumber}\nCountry: ${countryCode}\nReason: Blocked country code\n\nUser has been automatically blocked.`)
                    });
                }
                
                return true;
            }
        }
    } catch (e) {}
    return false;
}

// ============================================
// LOAD SETTINGS FUNCTION (FAST)
// ============================================
async function loadSettings() {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            // Create default settings
            settings = await Settings.create({
                antilink: true,
                antiporn: true,
                antiscam: true,
                antimedia: 'off',
                antitag: true,
                antiviewonce: true,
                antidelete: true,
                chatbot: true,
                workMode: 'public',
                autoRead: true,
                autoReact: true,
                autoSave: true,
                autoTyping: true,
                antibug: true,
                antispam: true,
                channelSubscription: true,
                autoReactChannel: true,
                autoBio: true,
                anticall: false,
                welcomeGoodbye: true,
                sleepingMode: false,
                autoStatusView: true,
                autoStatusLike: true,
                autoStatusReply: true,
                antilinkAction: 'warn',
                antipornAction: 'remove',
                antiscamAction: 'remove',
                autoblockCountries: []
            });
            console.log(fancy('[SETTINGS] ✅ Created default settings'));
        }
        return settings;
    } catch (error) {
        console.error('Load settings error:', error.message);
        // Return default settings
        return {
            antilink: true,
            antiporn: true,
            antiscam: true,
            antimedia: 'off',
            antitag: true,
            antiviewonce: true,
            antidelete: true,
            chatbot: true,
            workMode: 'public',
            autoRead: true,
            autoReact: true,
            autoSave: true,
            autoTyping: true,
            antibug: true,
            antispam: true,
            channelSubscription: true,
            autoReactChannel: true,
            autoBio: true,
            anticall: false,
            welcomeGoodbye: true,
            sleepingMode: false,
            autoStatusView: true,
            autoStatusLike: true,
            autoStatusReply: true
        };
    }
}

// ============================================
// AI CHATBOT REPLY (FAST & MULTILINGUAL)
// ============================================
async function handleChatbot(conn, from, body, settings) {
    try {
        if (!body || body.trim().length < 2) return;
        
        // Auto typing indicator
        if (settings.autoTyping) {
            try {
                await conn.sendPresenceUpdate('composing', from);
            } catch (error) {}
        }
        
        const aiResponse = await axios.get(`${config.aiModel}${encodeURIComponent(body)}?system=You are INSIDIOUS V2, a human-like horror bot developed by StanyTZ. Detect user's language and reply in the same language. If they use Swahili, reply in Swahili.`);
        
        const response = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy(aiResponse.data)}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
        
        await conn.sendMessage(from, { 
            text: response
        });
        
        return true;
    } catch (e) {
        console.error("AI Chatbot error:", e.message);
        return false;
    }
}

// ============================================
// CHANNEL SUBSCRIPTION CHECK
// ============================================
async function checkChannelSubscription(conn, sender) {
    try {
        // Skip check for bot owner
        if (botOwnerJid && sender === botOwnerJid) {
            return true;
        }
        
        // Check if user is subscribed to channel
        const isSubscribed = await ChannelSubscriber.findOne({ jid: sender, isActive: true });
        
        if (!isSubscribed) {
            // Send channel link
            await conn.sendMessage(sender, {
                text: fancy(`📢 *CHANNEL SUBSCRIPTION REQUIRED*\n\nTo use this bot, you must join our channel!\n\n🔗 ${config.channelLink || 'https://whatsapp.com/channel/0029Va...'}\n\nAfter joining, try again!`)
            });
            return false;
        }
        
        return true;
    } catch (e) {
        console.error('Channel check error:', e.message);
        return true; // Allow if check fails
    }
}

// ============================================
// MAIN HANDLER (FAST & OPTIMIZED)
// ============================================
module.exports = async (conn, m) => {
    try {
        if (!m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "Unknown";
        
        const body = (type === 'conversation') ? msg.message.conversation : 
                    (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : 
                    (type === 'imageMessage') ? msg.message.imageMessage.caption : 
                    (type === 'videoMessage') ? msg.message.videoMessage.caption : 
                    '';
        
        const isGroup = from.endsWith('@g.us');
        const isCmd = body && body.startsWith(config.prefix || '!');
        const command = isCmd ? body.slice((config.prefix || '!').length).trim().split(' ')[0].toLowerCase() : '';
        const args = body ? body.trim().split(/ +/).slice(1) : [];

        // SET BOT OWNER
        if (!botOwnerJid && conn.user) {
            botOwnerJid = getBotOwner(conn);
            if (botOwnerJid) {
                console.log(fancy(`[OWNER] ✅ Bot owner set to: ${botOwnerJid}`));
            }
        }

        // Check if sender is owner
        const isOwner = botOwnerJid ? 
            (sender === botOwnerJid || msg.key.fromMe) : 
            (msg.key.fromMe || (config.ownerNumber || []).includes(sender.split('@')[0]));

        // LOAD SETTINGS
        const settings = await loadSettings();
        if (!settings) return;

        // AUTO REACT TO CHANNEL POSTS (MUST BE FIRST)
        if (config.newsletterJid || from === channelJid) {
            const reacted = await handleChannelAutoReact(conn, msg);
            if (reacted) return; // If it was a channel post we reacted to, stop processing
        }

        // AUTO BLOCK COUNTRY NUMBERS
        if (!isOwner && !isGroup && settings.autoblockCountries && settings.autoblockCountries.length > 0) {
            await handleAutoBlockCountry(conn, sender);
        }

        // CHANNEL SUBSCRIPTION CHECK
        if (settings.channelSubscription && !isOwner && !msg.key.fromMe && !isGroup) {
            const canProceed = await checkChannelSubscription(conn, sender);
            if (!canProceed) return;
        }

        // DAILY SESSION SYNC
        const now = Date.now();
        if (now - lastSessionSync > 24 * 60 * 60 * 1000) {
            lastSessionSync = now;
            setTimeout(() => {
                syncSessionsWithChannel(conn);
            }, 30000);
        }

        // SKIP CHANNEL MESSAGES
        if (from === config.newsletterJid || from === channelJid) return;

        // ANTI VIEW ONCE (SILENT)
        if (settings.antiviewonce) {
            if (await handleViewOnce(conn, msg, sender)) return;
        }

        // ANTI DELETE (SILENT)
        if (settings.antidelete) {
            if (await handleAntiDelete(conn, msg, from, sender)) return;
        }

        // AUTO READ
        if (settings.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (error) {}
        }

        // AUTO REACT (PRIVATE ONLY - FAST)
        if (settings.autoReact && !msg.key.fromMe && !isGroup) {
            try {
                const reactions = ['❤️', '🔥', '⭐', '👍'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                await conn.sendMessage(from, { 
                    react: { text: randomReaction, key: msg.key } 
                });
            } catch (error) {}
        }

        // AUTO SAVE CONTACT
        if (settings.autoSave && !isOwner && !isGroup) {
            try {
                await User.findOneAndUpdate(
                    { jid: sender },
                    {
                        jid: sender,
                        name: pushname,
                        lastActive: new Date(),
                        $inc: { messageCount: 1 }
                    },
                    { upsert: true, new: true }
                );
            } catch (error) {}
        }

        // WORK MODE CHECK
        if (settings.workMode === 'private' && !isOwner) {
            return;
        }

        // ANTI-FEATURES CHECK (FOR GROUPS)
        if (isGroup && body) {
            // Anti-link
            if (await handleAntiLink(conn, msg, from, sender, body, settings)) return;
            
            // Anti-scam
            if (await handleAntiScam(conn, msg, from, sender, body, settings)) return;
            
            // Anti-media
            if (await handleAntiMedia(conn, msg, from, sender, settings)) return;
            
            // Anti-tag
            if (await handleAntiTag(conn, msg, from, sender, body, settings)) return;
            
            // Anti-spam
            if (await handleAntiSpam(conn, msg, from, sender, body, settings)) return;
            
            // Anti-bugs (SAFE VERSION)
            if (await handleAntiBugs(conn, msg, from, sender, body, settings)) return;
        }

        // COMMAND HANDLING (ALL OTHER COMMANDS)
        if (isCmd && command) {
            // Owner check for sensitive commands
            const sensitiveCommands = ['eval', 'exec', 'term', 'bash', 'shell'];
            if (sensitiveCommands.includes(command) && !isOwner) {
                const reply = createReplyFunction(conn, from, msg);
                await reply(fancy(`❌ This command is only for bot owner!`));
                return;
            }
            
            await loadCommand(command, conn, from, msg, args, settings, isOwner, sender, pushname);
            return;
        }

        // AI CHATBOT (FAST RESPONSE)
        if (settings.chatbot && !isCmd && !msg.key.fromMe && body && body.trim().length > 1) {
            await handleChatbot(conn, from, body, settings);
            return;
        }

    } catch (err) {
        console.error("Handler Error:", err.message);
    }
};

// ============================================
// INITIALIZE ON BOT START
// ============================================
module.exports.init = async (conn) => {
    try {
        console.log(fancy('[SYSTEM] ⚡ Initializing bot...'));
        
        // Set bot owner
        botOwnerJid = getBotOwner(conn);
        if (botOwnerJid) {
            console.log(fancy(`[OWNER] ✅ Bot owner: ${botOwnerJid}`));
            
            // Make sure owner is in channel subscribers
            try {
                const ownerSubscribed = await ChannelSubscriber.findOne({ jid: botOwnerJid });
                if (!ownerSubscribed) {
                    await ChannelSubscriber.create({
                        jid: botOwnerJid,
                        name: 'Bot Owner',
                        subscribedAt: new Date(),
                        isActive: true,
                        autoFollow: true,
                        lastActive: new Date(),
                        source: 'owner-initialization'
                    });
                    console.log(fancy(`[CHANNEL] 👑 Owner added to channel subscribers`));
                }
            } catch (e) {
                console.error('[CHANNEL] Error adding owner:', e.message);
            }
        }
        
        // Clear command cache
        clearCommandCache();
        
        // Auto-follow ALL users including old 2024 sessions
        setTimeout(async () => {
            const followed = await autoFollowAllUsers(conn);
            console.log(fancy(`[CHANNEL] 📊 Total auto-followed: ${followed} users`));
        }, 10000);
        
        // Initial sync of all sessions
        setTimeout(async () => {
            await syncSessionsWithChannel(conn);
        }, 15000);
        
        console.log(fancy('[SYSTEM] ✅ Bot initialized successfully!'));
        
    } catch (error) {
        console.error('Initialization error:', error.message);
    }
};

// ============================================
// EXPORT HELPER FUNCTIONS
// ============================================
module.exports.clearCommandCache = clearCommandCache;
module.exports.loadCommand = loadCommand;
module.exports.createReplyFunction = createReplyFunction;
module.exports.handleAntiLink = handleAntiLink;
module.exports.handleAntiScam = handleAntiScam;
module.exports.handleAntiMedia = handleAntiMedia;
module.exports.handleAntiTag = handleAntiTag;
module.exports.handleAntiSpam = handleAntiSpam;