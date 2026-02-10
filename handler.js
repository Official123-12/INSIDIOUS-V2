const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');

// DATABASE MODELS - SIMPLE VERSION
const mongoose = require('mongoose');

// Create simple models if not exist
let User, Group, ChannelSubscriber, Settings;
try {
    // Try to get from database
    const UserSchema = new mongoose.Schema({
        jid: String, name: String, deviceId: String, linkedAt: Date, isActive: Boolean
    });
    const GroupSchema = new mongoose.Schema({
        jid: String, name: String, participants: Number, admins: Array, joinedAt: Date
    });
    const SettingsSchema = new mongoose.Schema({
        antilink: Boolean, antiporn: Boolean, antiscam: Boolean, antimedia: Boolean,
        antitag: Boolean, antiviewonce: Boolean, antidelete: Boolean, sleepingMode: Boolean,
        welcomeGoodbye: Boolean, chatbot: Boolean, autoRead: Boolean, autoReact: Boolean,
        autoBio: Boolean, anticall: Boolean, antispam: Boolean, antibug: Boolean,
        autoStatus: Boolean, autoStatusReply: Boolean
    });
    
    User = mongoose.model('User', UserSchema) || { findOne: async () => null, countDocuments: async () => 0 };
    Group = mongoose.model('Group', GroupSchema) || { findOne: async () => null, countDocuments: async () => 0 };
    Settings = mongoose.model('Settings', SettingsSchema) || { 
        findOne: async () => ({ 
            antilink: true, antiporn: true, antiscam: true, antimedia: false, antitag: true,
            antiviewonce: true, antidelete: true, sleepingMode: false, welcomeGoodbye: true,
            chatbot: true, autoRead: true, autoReact: true, autoBio: true, anticall: true,
            antispam: true, antibug: true, autoStatus: true, autoStatusReply: true,
            save: async function() { return this; }
        }) 
    };
} catch (error) {
    console.log("⚠️ Using simple database models");
    User = { findOne: async () => null, countDocuments: async () => 0 };
    Group = { findOne: async () => null, countDocuments: async () => 0 };
    Settings = { 
        findOne: async () => ({ 
            antilink: true, antiporn: true, antiscam: true, antimedia: false, antitag: true,
            antiviewonce: true, antidelete: true, sleepingMode: false, welcomeGoodbye: true,
            chatbot: true, autoRead: true, autoReact: true, autoBio: true, anticall: true,
            antispam: true, antibug: true, autoStatus: true, autoStatusReply: true,
            save: async function() { return this; }
        }) 
    };
}

// MESSAGE STORE
const messageStore = new Map();

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
        return user?.name || getUsername(jid);
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
// SIMPLE COMMAND LOADER
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
            
            const possibleFile = path.join(catPath, `${command}.js`);
            if (fs.existsSync(possibleFile)) {
                commandFile = possibleFile;
                break;
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
async function handleChatbot(conn, from, body, pushname) {
    try {
        if (!body || body.trim().length < 1) return false;
        
        // Typing indicator
        try {
            await conn.sendPresenceUpdate('composing', from);
        } catch (e) {}
        
        // Get AI response
        const aiResponse = await getAIResponse(body);
        
        // Send response
        await conn.sendMessage(from, { 
            text: aiResponse 
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
// MAIN HANDLER - SIMPLE & FAST
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
        const isCmd = body && body.startsWith(config.prefix);
        const command = isCmd ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = isCmd ? body.trim().split(/ +/).slice(1) : [];
        
        // SET BOT OWNER
        if (!botOwnerJid && conn.user) {
            botOwnerJid = conn.user.id;
            console.log(`[OWNER] Bot owner: ${getUsername(botOwnerJid)}`);
        }
        
        // Check if sender is owner
        const isOwner = botOwnerJid ? (sender === botOwnerJid || msg.key.fromMe) : false;
        
        // STORE MESSAGE
        storeMessage(msg);
        
        // ANTI VIEWONCE
        if (config.antiviewonce) {
            if (await handleViewOnce(conn, msg)) return;
        }
        
        // ANTI DELETE
        if (config.antidelete) {
            if (await handleAntiDelete(conn, msg)) return;
        }
        
        // AUTO READ
        if (config.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (e) {}
        }
        
        // COMMAND HANDLING
        if (isCmd && command) {
            await loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup);
            return;
        }
        
        // CHATBOT - REPLIES TO EVERYONE
        if (body && body.trim().length > 0 && !isCmd && !msg.key.fromMe) {
            if (config.chatbot) {
                await handleChatbot(conn, from, body, pushname);
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
        console.log('[SYSTEM] Initializing Insidious...');
        
        if (conn.user) {
            botOwnerJid = conn.user.id;
            console.log(`[OWNER] Bot Owner: ${getUsername(botOwnerJid)}`);
        }
        
        console.log('[SYSTEM] ✅ Bot initialized successfully');
        
    } catch (error) {
        console.error('Init error:', error.message);
    }
};
