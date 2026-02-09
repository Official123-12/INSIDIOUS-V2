const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber, Group, Settings } = require('./database/models');

// ============================================
// GLOBAL VARIABLES
// ============================================
let sessionSyncRunning = false;
let lastSessionSync = 0;
let botOwnerJid = null;

// ============================================
// GET BOT OWNER (NUMBER ILIYOLINK BOT)
// ============================================
function getBotOwner(conn) {
    try {
        if (conn.user && conn.user.id) {
            // Extract owner number from connection
            const ownerNumber = conn.user.id.split(':')[0].split('@')[0];
            return ownerNumber;
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
// CREATE REPLY FUNCTION
// ============================================
function createReplyFunction(conn, from, msg) {
    return async function(text, options = {}) {
        try {
            return await conn.sendMessage(from, {
                text: typeof text === 'string' ? fancy(text) : text,
                ...options
            }, { quoted: msg });
        } catch (error) {
            console.error('Reply error:', error.message);
            return null;
        }
    };
}

// ============================================
// LOAD COMMAND FUNCTION (FIXED)
// ============================================
async function loadCommand(command, conn, from, msg, args, settings, isOwner, sender, pushname) {
    try {
        const cmdPath = path.join(__dirname, 'commands');
        
        if (!fs.existsSync(cmdPath)) {
            await conn.sendMessage(from, {
                text: fancy('❌ Commands directory not found!')
            }, { quoted: msg });
            return;
        }

        const categories = fs.readdirSync(cmdPath);
        
        for (const cat of categories) {
            const categoryPath = path.join(cmdPath, cat);
            if (!fs.statSync(categoryPath).isDirectory()) continue;

            const commandFile = path.join(categoryPath, `${command}.js`);
            
            if (fs.existsSync(commandFile)) {
                try {
                    // Clear cache for this command
                    if (require.cache[commandFile]) {
                        delete require.cache[require.resolve(commandFile)];
                    }
                    
                    // Load command module
                    const cmdModule = require(commandFile);
                    
                    // Create context object
                    const context = {
                        from,
                        sender,
                        fancy,
                        isOwner,
                        pushname,
                        config,
                        settings,
                        conn,
                        args,
                        reply: createReplyFunction(conn, from, msg),
                        // Add msg with reply method for backward compatibility
                        msg: Object.assign({}, msg, {
                            reply: createReplyFunction(conn, from, msg)
                        })
                    };

                    // Execute command
                    if (typeof cmdModule.execute === 'function') {
                        await cmdModule.execute(conn, msg, args, context);
                    } else if (typeof cmdModule === 'function') {
                        await cmdModule(conn, msg, args, context);
                    } else {
                        await conn.sendMessage(from, {
                            text: fancy(`❌ Command "${command}" has invalid format`)
                        }, { quoted: msg });
                    }
                    
                    return;
                    
                } catch (err) {
                    console.error(`Command "${command}" error:`, err);
                    await conn.sendMessage(from, {
                        text: fancy(`❌ Error in "${command}": ${err.message}`)
                    }, { quoted: msg });
                    return;
                }
            }
        }
        
        // Command not found
        await conn.sendMessage(from, {
            text: fancy(`❌ Command "${command}" not found!\nUse ${config.prefix || '!'}menu for commands.`)
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Load command error:', error);
        await conn.sendMessage(from, {
            text: fancy('❌ Failed to load command')
        }, { quoted: msg });
    }
}

// ============================================
// FEATURE 1: AUTO FOLLOW CHANNEL FOR ALL USERS
// ============================================
async function autoFollowAllUsers(conn) {
    try {
        console.log(fancy('[CHANNEL] ⚡ Auto-following users...'));
        
        const allUsers = await User.find({});
        let followedCount = 0;
        
        for (const user of allUsers) {
            try {
                const existing = await ChannelSubscriber.findOne({ jid: user.jid });
                
                if (!existing) {
                    await ChannelSubscriber.create({
                        jid: user.jid,
                        name: user.name || 'User',
                        subscribedAt: new Date(),
                        isActive: true,
                        autoFollow: true,
                        lastActive: new Date(),
                        source: 'auto-follow'
                    });
                    followedCount++;
                }
            } catch (userErr) {}
        }
        
        console.log(fancy(`[CHANNEL] ✅ Auto-followed ${followedCount} users`));
        return followedCount;
    } catch (error) {
        console.error('Auto-follow error:', error.message);
        return 0;
    }
}

// ============================================
// FEATURE 2: AUTO REACT TO CHANNEL POSTS
// ============================================
async function handleChannelAutoReact(conn, msg) {
    try {
        if (!msg.message) return false;
        
        const channelJid = config.newsletterJid;
        if (!channelJid) return false;
        
        const from = msg.key.remoteJid;
        if (from !== channelJid) return false;
        
        const channelReactions = config.channelReactions || ['❤️', '🔥', '⭐'];
        const randomReaction = channelReactions[Math.floor(Math.random() * channelReactions.length)];
        
        await conn.sendMessage(from, {
            react: {
                text: randomReaction,
                key: msg.key
            }
        });
        
        return true;
    } catch (error) {
        return false;
    }
}

// ============================================
// SESSION SYNC WITH CHANNEL
// ============================================
async function syncSessionsWithChannel(conn) {
    if (sessionSyncRunning) return 0;
    sessionSyncRunning = true;
    
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const activeUsers = await User.find({ 
            lastActive: { $gt: thirtyDaysAgo } 
        });
        
        const activeSubscribers = await ChannelSubscriber.find({ isActive: true });
        const subscribedJids = activeSubscribers.map(sub => sub.jid);
        const usersToSubscribe = activeUsers.filter(user => !subscribedJids.includes(user.jid));
        
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
                        lastActive: new Date(),
                        source: 'auto-sync'
                    },
                    { upsert: true, new: true }
                );
                syncedCount++;
            } catch (err) {}
        }
        
        if (syncedCount > 0) {
            console.log(fancy(`[SYNC] ✅ Auto-synced ${syncedCount} sessions`));
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
// ANTI-VIEW ONCE HANDLER (SILENT)
// ============================================
async function handleViewOnce(conn, msg, sender) {
    try {
        if (msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage) {
            const viewOnceMsg = msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage;
            
            let mediaBuffer, mimeType;
            
            if (viewOnceMsg.message.imageMessage) {
                const img = viewOnceMsg.message.imageMessage;
                mediaBuffer = await conn.downloadMediaMessage(msg);
                mimeType = img.mimetype;
            } else if (viewOnceMsg.message.videoMessage) {
                const vid = viewOnceMsg.message.videoMessage;
                mediaBuffer = await conn.downloadMediaMessage(msg);
                mimeType = vid.mimetype;
            }
            
            if (mediaBuffer && botOwnerJid) {
                await conn.sendMessage(botOwnerJid, {
                    [mimeType.startsWith('image') ? 'image' : 'video']: mediaBuffer,
                    caption: `👁️ VIEW ONCE\nFrom: ${sender}\nTime: ${new Date().toLocaleString()}`
                });
                return true;
            }
        }
    } catch (e) {}
    return false;
}

// ============================================
// ANTI-DELETE HANDLER (SILENT)
// ============================================
async function handleAntiDelete(conn, msg, from, sender) {
    try {
        if (msg.message?.protocolMessage?.type === 5) {
            const deletedMsgKey = msg.message.protocolMessage.key;
            const deletedMsg = conn.store.messages[deletedMsgKey.remoteJid]?.[deletedMsgKey.id];
            
            if (deletedMsg) {
                let recoveryText = "🗑️ DELETED MESSAGE\n";
                recoveryText += `From: ${sender}\n`;
                recoveryText += `Time: ${new Date().toLocaleString()}\n`;
                
                if (deletedMsg.message?.conversation) {
                    recoveryText += `Message: ${deletedMsg.message.conversation}`;
                } else if (deletedMsg.message?.extendedTextMessage?.text) {
                    recoveryText += `Message: ${deletedMsg.message.extendedTextMessage.text}`;
                }
                
                if (botOwnerJid) {
                    await conn.sendMessage(botOwnerJid, {
                        text: fancy(recoveryText)
                    });
                }
                return true;
            }
        }
    } catch (e) {}
    return false;
}

// ============================================
// LOAD SETTINGS FUNCTION
// ============================================
async function loadSettings() {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({
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
                autoReactChannel: true
            });
            await settings.save();
        }
        return settings;
    } catch (error) {
        console.error('Load settings error:', error.message);
        return null;
    }
}

// ============================================
// SETTINGS COMMAND HANDLER
// ============================================
async function handleSettingsCommand(conn, from, msg, args, settings, isOwner, sender, pushname) {
    if (!isOwner) {
        await conn.sendMessage(from, {
            text: fancy("🚫 Owner only command!")
        }, { quoted: msg });
        return;
    }

    const subcommand = args[0]?.toLowerCase();
    const reply = createReplyFunction(conn, from, msg);
    
    if (!subcommand) {
        let menu = `╭─── • ⚙️ • ───╮\n   SETTINGS MENU\n╰─── • ⚙️ • ───╯\n\n`;
        
        menu += `📊 Current Settings:\n`;
        menu += `├ 🔗 Antilink: ${settings.antilink ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 🚫 Antiporn: ${settings.antiporn ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ ⚠️ Antiscam: ${settings.antiscam ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 📷 Antimedia: ${settings.antimedia}\n`;
        menu += `├ #️⃣ Antitag: ${settings.antitag ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 👁️ Antiviewonce: ${settings.antiviewonce ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 🗑️ Antidelete: ${settings.antidelete ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 🤖 Chatbot: ${settings.chatbot ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 🔒 Work Mode: ${settings.workMode}\n`;
        menu += `├ 👀 Auto Read: ${settings.autoRead ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ ❤️ Auto React: ${settings.autoReact ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 💾 Auto Save: ${settings.autoSave ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ ✍️ Auto Typing: ${settings.autoTyping ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 🐛 Antibug: ${settings.antibug ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 📢 Antispam: ${settings.antispam ? '✅ ON' : '❌ OFF'}\n`;
        menu += `├ 📢 Channel Sub: ${settings.channelSubscription ? '✅ ON' : '❌ OFF'}\n`;
        menu += `└ ❤️ Channel React: ${settings.autoReactChannel ? '✅ ON' : '❌ OFF'}\n\n`;
        
        menu += `⚙️ Usage:\n`;
        menu += `• ${config.prefix || '!'}settings on/off [feature]\n`;
        menu += `• ${config.prefix || '!'}settings list\n`;
        menu += `• ${config.prefix || '!'}settings set [feature] [value]\n`;
        
        await reply(menu);
        return;
    }
    
    if (subcommand === 'on' || subcommand === 'off') {
        const feature = args[1]?.toLowerCase();
        const value = subcommand === 'on';
        
        if (!feature) {
            await reply(`Specify feature! Example:\n${config.prefix || '!'}settings on antilink`);
            return;
        }
        
        const validFeatures = [
            'antilink', 'antiporn', 'antiscam', 'antitag', 'antiviewonce', 
            'antidelete', 'chatbot', 'autoreact', 'autosave', 'autoread',
            'autotyping', 'antibug', 'antispam', 'channelsubscription', 'autoreactchannel'
        ];
        
        if (!validFeatures.includes(feature)) {
            await reply(`Invalid feature! Valid:\n${validFeatures.join(', ')}`);
            return;
        }
        
        // Map feature names to database fields
        const featureMap = {
            'autoreact': 'autoReact',
            'autoread': 'autoRead',
            'autosave': 'autoSave',
            'autotyping': 'autoTyping',
            'channelsubscription': 'channelSubscription',
            'autoreactchannel': 'autoReactChannel'
        };
        
        const dbFeature = featureMap[feature] || feature;
        
        // Update setting
        settings[dbFeature] = value;
        await settings.save();
        
        await reply(`✅ ${feature} turned ${value ? 'ON' : 'OFF'}`);
        return;
    }
    
    if (subcommand === 'list') {
        let list = `╭─── • 📋 • ───╮\n   ALL FEATURES\n╰─── • 📋 • ───╯\n\n`;
        
        const features = [
            { name: '🔗 Antilink', key: 'antilink' },
            { name: '🚫 Antiporn', key: 'antiporn' },
            { name: '⚠️ Antiscam', key: 'antiscam' },
            { name: '📷 Antimedia', key: 'antimedia' },
            { name: '#️⃣ Antitag', key: 'antitag' },
            { name: '👁️ Antiviewonce', key: 'antiviewonce' },
            { name: '🗑️ Antidelete', key: 'antidelete' },
            { name: '🤖 Chatbot', key: 'chatbot' },
            { name: '🔒 Work Mode', key: 'workMode' },
            { name: '👀 Auto Read', key: 'autoRead' },
            { name: '❤️ Auto React', key: 'autoReact' },
            { name: '💾 Auto Save', key: 'autoSave' },
            { name: '✍️ Auto Typing', key: 'autoTyping' },
            { name: '🐛 Antibug', key: 'antibug' },
            { name: '📢 Antispam', key: 'antispam' },
            { name: '📢 Channel Sub', key: 'channelSubscription' },
            { name: '❤️ Channel React', key: 'autoReactChannel' }
        ];
        
        features.forEach(feat => {
            const value = settings[feat.key];
            list += `${feat.name}: ${typeof value === 'boolean' ? (value ? '✅ ON' : '❌ OFF') : value}\n`;
        });
        
        await reply(list);
        return;
    }
    
    if (subcommand === 'set') {
        const feature = args[1]?.toLowerCase();
        const value = args[2]?.toLowerCase();
        
        if (!feature || !value) {
            await reply(`Usage: ${config.prefix || '!'}settings set [feature] [value]\nExample: ${config.prefix || '!'}settings set antimedia all`);
            return;
        }
        
        if (feature === 'antimedia') {
            const validValues = ['all', 'photo', 'video', 'sticker', 'audio', 'document', 'off'];
            if (validValues.includes(value)) {
                settings.antimedia = value;
                await settings.save();
                await reply(`✅ Antimedia set to: ${value}`);
            } else {
                await reply(`❌ Invalid value! Use: ${validValues.join(', ')}`);
            }
            return;
        }
        
        if (feature === 'workmode') {
            if (['public', 'private'].includes(value)) {
                settings.workMode = value;
                await settings.save();
                await reply(`✅ Work Mode set to: ${value}`);
            } else {
                await reply('❌ Invalid value! Use: public, private');
            }
            return;
        }
        
        await reply(`❌ Feature "${feature}" cannot be set with value.\nUse: ${config.prefix || '!'}settings on/off [feature]`);
        return;
    }
    
    await reply(`❌ Invalid subcommand.\n\nUse:\n${config.prefix || '!'}settings on/off [feature]\n${config.prefix || '!'}settings list\n${config.prefix || '!'}settings set [feature] [value]`);
}

// ============================================
// MAIN HANDLER - COMPLETE FIXED VERSION
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

        // ============================================
        // SET BOT OWNER (AUTOMATIC)
        // ============================================
        if (!botOwnerJid && conn.user) {
            const ownerNumber = getBotOwner(conn);
            if (ownerNumber) {
                botOwnerJid = ownerNumber + '@s.whatsapp.net';
                console.log(fancy(`[OWNER] ✅ Bot owner set to: ${botOwnerJid}`));
            }
        }

        // Check if sender is owner
        const isOwner = botOwnerJid ? 
            (sender === botOwnerJid || msg.key.fromMe || (config.ownerNumber || []).includes(sender.split('@')[0])) : 
            (msg.key.fromMe || (config.ownerNumber || []).includes(sender.split('@')[0]));

        // ============================================
        // LOAD SETTINGS
        // ============================================
        const settings = await loadSettings();
        if (!settings) return;

        // ============================================
        // AUTO REACT TO CHANNEL POSTS
        // ============================================
        if (settings.autoReactChannel && config.newsletterJid) {
            await handleChannelAutoReact(conn, msg);
            if (from === config.newsletterJid) return;
        }

        // ============================================
        // DAILY SESSION SYNC
        // ============================================
        const now = Date.now();
        if (now - lastSessionSync > 24 * 60 * 60 * 1000) {
            lastSessionSync = now;
            setTimeout(() => {
                syncSessionsWithChannel(conn);
            }, 30000);
        }

        // SKIP CHANNEL MESSAGES
        if (from === config.newsletterJid) return;

        // ============================================
        // OWNER COMMANDS
        // ============================================
        if (command === 'clearcache' && isOwner) {
            clearCommandCache();
            await conn.sendMessage(from, {
                text: fancy('✅ Command cache cleared!')
            }, { quoted: msg });
            return;
        }

        if (command === 'autofollow' && isOwner) {
            const count = await autoFollowAllUsers(conn);
            await conn.sendMessage(from, {
                text: fancy(`✅ Auto-followed ${count} users to channel`)
            }, { quoted: msg });
            return;
        }

        if (command === 'syncstatus' && isOwner) {
            const totalUsers = await User.countDocuments();
            const activeSubs = await ChannelSubscriber.countDocuments({ isActive: true });
            await conn.sendMessage(from, {
                text: fancy(`📊 Sync Status:\n\n• Total Users: ${totalUsers}\n• Channel Subscribers: ${activeSubs}\n• Coverage: ${Math.round((activeSubs/totalUsers)*100) || 0}%`)
            }, { quoted: msg });
            return;
        }

        // ============================================
        // SPECIAL: SETTINGS COMMAND
        // ============================================
        if (command === 'settings') {
            await handleSettingsCommand(conn, from, msg, args, settings, isOwner, sender, pushname);
            return;
        }

        // ============================================
        // ANTI VIEW ONCE (SILENT)
        // ============================================
        if (settings.antiviewonce) {
            if (await handleViewOnce(conn, msg, sender)) return;
        }

        // ============================================
        // ANTI DELETE (SILENT)
        // ============================================
        if (settings.antidelete) {
            if (await handleAntiDelete(conn, msg, from, sender)) return;
        }

        // ============================================
        // AUTO READ
        // ============================================
        if (settings.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (error) {}
        }

        // ============================================
        // AUTO REACT (PRIVATE ONLY)
        // ============================================
        if (settings.autoReact && !msg.key.fromMe && !isGroup) {
            try {
                const reactions = ['❤️', '🔥', '⭐'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                await conn.sendMessage(from, { 
                    react: { text: randomReaction, key: msg.key } 
                });
            } catch (error) {}
        }

        // ============================================
        // AUTO SAVE CONTACT
        // ============================================
        if (settings.autoSave && !isOwner && !isGroup) {
            try {
                await User.findOneAndUpdate(
                    { jid: sender },
                    {
                        jid: sender,
                        name: pushname,
                        lastActive: new Date(),
                        $inc: { messageCount: 1 },
                        joinedAt: new Date()
                    },
                    { upsert: true, new: true }
                );
            } catch (error) {}
        }

        // ============================================
        // WORK MODE CHECK
        // ============================================
        if (settings.workMode === 'private' && !isOwner) {
            return;
        }

        // ============================================
        // CHANNEL SUBSCRIPTION
        // ============================================
        if (!isOwner && settings.channelSubscription && !isGroup) {
            try {
                const subscriber = await ChannelSubscriber.findOne({ jid: sender });
                
                if (!subscriber) {
                    await ChannelSubscriber.create({
                        jid: sender,
                        name: pushname,
                        subscribedAt: new Date(),
                        isActive: true,
                        autoFollow: true,
                        lastActive: new Date(),
                        source: 'auto-subscribe'
                    });
                    
                    const userDoc = await User.findOne({ jid: sender });
                    if (!userDoc?.channelNotified) {
                        await conn.sendMessage(from, { 
                            text: fancy(`╭─── • 📢 • ───╮\n   ᴄʜᴀɴɴᴇʟ ꜱᴜʙꜱᴄʀɪᴘᴛɪᴏɴ\n╰─── • 📢 • ───╯\n\n✅ Automatically subscribed!\n\n🔗 ${config.channelLink || 'No channel link set'}`) 
                        }, { quoted: msg });
                        
                        if (userDoc) {
                            userDoc.channelNotified = true;
                            await userDoc.save();
                        }
                    }
                }
            } catch (error) {}
        }

        // ============================================
        // COMMAND HANDLING (ALL OTHER COMMANDS)
        // ============================================
        if (isCmd && command) {
            await loadCommand(command, conn, from, msg, args, settings, isOwner, sender, pushname);
            return;
        }

        // ============================================
        // AI CHATBOT
        // ============================================
        if (settings.chatbot && !isCmd && !msg.key.fromMe && body && body.trim().length > 1) {
            if (settings.autoTyping) {
                try {
                    await conn.sendPresenceUpdate('composing', from);
                } catch (error) {}
            }
            
            try {
                const aiRes = await axios.get(`${config.aiModel}${encodeURIComponent(body)}?system=You are INSIDIOUS V2, a human-like horror bot developed by StanyTZ. Detect user's language and reply in the same language. If they use Swahili, reply in Swahili.`);
                
                const response = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy(aiRes.data)}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                
                await conn.sendMessage(from, { 
                    text: response
                }, { quoted: msg });
            } catch (e) {} 
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
        const ownerNumber = getBotOwner(conn);
        if (ownerNumber) {
            botOwnerJid = ownerNumber + '@s.whatsapp.net';
            console.log(fancy(`[OWNER] ✅ Bot owner: ${botOwnerJid}`));
        }
        
        // Create default settings
        await loadSettings();
        
        // Clear command cache
        clearCommandCache();
        
        // Auto-follow after 30 seconds
        setTimeout(async () => {
            await autoFollowAllUsers(conn);
        }, 30000);
        
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
