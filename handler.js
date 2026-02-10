const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ✅ **LOAD CONFIG**
const config = require('./config');

// ✅ **FANCY FUNCTION**
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const map = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ',
            0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉'
        };
        return text.split('').map(c => map[c] || c).join('');
    } catch {
        return text;
    }
}

// ✅ **STORAGE SYSTEMS**
const messageStore = new Map(); // For anti-delete
const userActivity = new Map(); // For auto-recording
const spamTracker = new Map(); // For anti-spam
const warningTracker = new Map(); // For warnings

// ✅ **HELPER FUNCTIONS**
function getUsername(jid) {
    if (!jid) return "Unknown";
    const parts = jid.split('@');
    return parts[0] || "Unknown";
}

async function getContactName(conn, jid) {
    try {
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

async function isBotAdmin(conn, groupJid) {
    try {
        if (!conn.user?.id) return false;
        const metadata = await conn.groupMetadata(groupJid);
        const participant = metadata.participants.find(p => p.id === conn.user.id);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch {
        return false;
    }
}

async function isUserAdmin(conn, groupJid, userJid) {
    try {
        const metadata = await conn.groupMetadata(groupJid);
        const participant = metadata.participants.find(p => p.id === userJid);
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

// ✅ **AUTO TYPING - REAL WORKING**
async function handleAutoTyping(conn, from) {
    try {
        await conn.sendPresenceUpdate('composing', from);
        // Auto pause after 3 seconds
        setTimeout(async () => {
            try {
                await conn.sendPresenceUpdate('paused', from);
            } catch (e) {}
        }, 3000);
    } catch (e) {
        // Silent error
    }
}

// ✅ **AUTO RECORDING - REAL WORKING**
async function handleAutoRecording(conn, msg) {
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        const timestamp = new Date();
        const messageId = msg.key.id;
        
        // Initialize user activity array
        if (!userActivity.has(sender)) {
            userActivity.set(sender, []);
        }
        
        // Determine message type
        let messageType = 'text';
        if (msg.message?.imageMessage) messageType = 'image';
        else if (msg.message?.videoMessage) messageType = 'video';
        else if (msg.message?.audioMessage) messageType = 'audio';
        else if (msg.message?.stickerMessage) messageType = 'sticker';
        else if (msg.message?.documentMessage) messageType = 'document';
        
        // Extract content
        let content = '';
        if (msg.message?.conversation) {
            content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage?.caption) {
            content = msg.message.imageMessage.caption || '';
        } else if (msg.message?.videoMessage?.caption) {
            content = msg.message.videoMessage.caption || '';
        }
        
        // Store activity
        const activity = {
            id: messageId,
            type: messageType,
            content: content,
            timestamp: timestamp,
            from: msg.key.remoteJid,
            isGroup: msg.key.remoteJid?.endsWith('@g.us') || false
        };
        
        userActivity.get(sender).push(activity);
        
        // Keep only last 100 activities per user
        if (userActivity.get(sender).length > 100) {
            userActivity.get(sender).shift();
        }
        
        // Log for debugging (optional)
        console.log(`[AUTO RECORDING] ${sender.substring(0, 15)}... | Type: ${messageType} | Length: ${content.length}`);
        
    } catch (error) {
        // Silent error - don't crash the bot
    }
}

// ✅ **ANTI VIEW ONCE - REAL WORKING**
async function handleViewOnce(conn, msg) {
    try {
        const viewOnceMsg = msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage;
        if (!viewOnceMsg) return false;
        
        const sender = msg.key.participant || msg.key.remoteJid;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        // Get sender info
        const senderName = await getContactName(conn, sender);
        let groupInfo = '';
        
        if (isGroup) {
            try {
                const groupName = await getGroupName(conn, from);
                groupInfo = `🏷️ *Group:* ${groupName}\n`;
            } catch (e) {}
        }
        
        // Extract content
        let content = '';
        let mediaType = '';
        
        if (viewOnceMsg.message?.conversation) {
            content = viewOnceMsg.message.conversation;
            mediaType = '📝 Text';
        } else if (viewOnceMsg.message?.extendedTextMessage?.text) {
            content = viewOnceMsg.message.extendedTextMessage.text;
            mediaType = '📝 Text';
        } else if (viewOnceMsg.imageMessage) {
            content = '📸 Image (View Once)';
            mediaType = '🖼️ Image';
        } else if (viewOnceMsg.videoMessage) {
            content = '🎥 Video (View Once)';
            mediaType = '🎬 Video';
        }
        
        // Send to owner if configured
        if (config.ownerNumber && Array.isArray(config.ownerNumber) && config.ownerNumber.length > 0) {
            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
            if (ownerNum.length >= 10) {
                const ownerJid = ownerNum + '@s.whatsapp.net';
                
                const reportMsg = `
👁️ *VIEW ONCE DETECTED*

👤 *Sender:* ${senderName}
📞 *Number:* ${getUsername(sender)}
${groupInfo}🕐 *Time:* ${new Date().toLocaleTimeString()}
📁 *Type:* ${mediaType}

📝 *Content:*
${content || 'Media Content'}

🔐 *Recovered by INSIDIOUS Security*`;
                
                try {
                    await conn.sendMessage(ownerJid, { text: reportMsg });
                } catch (e) {
                    console.error('Failed to send view once report:', e.message);
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('View once handler error:', error.message);
        return false;
    }
}

// ✅ **ANTI DELETE - REAL WORKING**
async function handleAntiDelete(conn, msg) {
    try {
        if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) {
            return false;
        }
        
        const deletedKey = msg.message.protocolMessage.key;
        const messageId = deletedKey.id;
        
        // Check if we have this message stored
        const storedMessage = messageStore.get(messageId);
        if (!storedMessage) return false;
        
        const sender = deletedKey.participant || deletedKey.remoteJid;
        const from = deletedKey.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        // Get sender info
        const senderName = await getContactName(conn, sender);
        let groupInfo = '';
        
        if (isGroup) {
            try {
                const groupName = await getGroupName(conn, from);
                groupInfo = `🏷️ *Group:* ${groupName}\n`;
            } catch (e) {}
        }
        
        // Send to owner if configured
        if (config.ownerNumber && Array.isArray(config.ownerNumber) && config.ownerNumber.length > 0) {
            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
            if (ownerNum.length >= 10) {
                const ownerJid = ownerNum + '@s.whatsapp.net';
                
                const reportMsg = `
🗑️ *DELETED MESSAGE DETECTED*

👤 *Sender:* ${senderName}
📞 *Number:* ${getUsername(sender)}
${groupInfo}🕐 *Deleted:* ${new Date().toLocaleTimeString()}
⏰ *Original:* ${storedMessage.timestamp}

📝 *Content:*
${storedMessage.content}

🔐 *Recovered by INSIDIOUS Security*`;
                
                try {
                    await conn.sendMessage(ownerJid, { text: reportMsg });
                } catch (e) {
                    console.error('Failed to send delete report:', e.message);
                }
            }
        }
        
        // Remove from storage
        messageStore.delete(messageId);
        return true;
        
    } catch (error) {
        console.error('Anti delete handler error:', error.message);
        return false;
    }
}

// ✅ **STORE MESSAGE FOR ANTI DELETE**
function storeMessage(msg) {
    try {
        if (!msg.key?.id || msg.key.fromMe) return;
        
        let content = '';
        
        // Extract text content
        if (msg.message?.conversation) {
            content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage?.caption) {
            content = msg.message.imageMessage.caption || '[Image]';
        } else if (msg.message?.videoMessage?.caption) {
            content = msg.message.videoMessage.caption || '[Video]';
        } else if (msg.message?.audioMessage) {
            content = '[Audio Message]';
        } else if (msg.message?.stickerMessage) {
            content = '[Sticker]';
        } else if (msg.message?.documentMessage) {
            content = `[Document] ${msg.message.documentMessage.fileName || 'File'}`;
        }
        
        // Store message
        if (content) {
            messageStore.set(msg.key.id, {
                content: content,
                sender: msg.key.participant || msg.key.remoteJid,
                from: msg.key.remoteJid,
                timestamp: new Date().toLocaleTimeString()
            });
            
            // Clean old messages (keep only last 500)
            if (messageStore.size > 500) {
                const keys = Array.from(messageStore.keys()).slice(0, 100);
                keys.forEach(key => messageStore.delete(key));
            }
        }
    } catch (error) {
        // Silent error
    }
}

// ✅ **ANTI LINK - REAL WORKING**
async function checkAntiLink(conn, msg, body, from, sender, reply) {
    try {
        if (!from.endsWith('@g.us')) return false;
        
        // Check if bot is admin
        const botAdmin = await isBotAdmin(conn, from);
        if (!botAdmin) return false;
        
        // Check for links
        const linkPatterns = [
            /chat\.whatsapp\.com/i,
            /whatsapp\.com/i,
            /wa\.me/i,
            /http:\/\//i,
            /https:\/\//i,
            /www\./i,
            /\.com/i,
            /\.net/i,
            /\.org/i
        ];
        
        const hasLink = linkPatterns.some(pattern => pattern.test(body));
        if (!hasLink) return false;
        
        const senderName = await getContactName(conn, sender);
        const groupName = await getGroupName(conn, from);
        
        // Warning system
        const warnings = (warningTracker.get(sender) || 0) + 1;
        warningTracker.set(sender, warnings);
        
        if (warnings >= 3) {
            // Remove user after 3 warnings
            try {
                await conn.groupParticipantsUpdate(from, [sender], 'remove');
                await reply(`🚫 *USER REMOVED*\n\n👤 ${senderName}\n📞 ${getUsername(sender)}\n🏷️ ${groupName}\n❌ Reason: Sharing links (3 warnings)`);
                warningTracker.delete(sender);
            } catch (e) {}
        } else {
            // Warn user
            await reply(`⚠️ *LINK DETECTED*\n\n👤 ${senderName}\n📞 ${getUsername(sender)}\n🏷️ ${groupName}\n🚫 Warning ${warnings}/3\n\nMessages with links are not allowed!`);
            
            // Delete the message with link
            try {
                await conn.sendMessage(from, { delete: msg.key });
            } catch (e) {}
        }
        
        return true;
    } catch (error) {
        console.error('Anti link error:', error.message);
        return false;
    }
}

// ✅ **AI RESPONSE - SILENT ON FAIL**
async function getAIResponse(message) {
    try {
        // Clean the message
        const cleanMsg = message.trim();
        if (!cleanMsg || cleanMsg.length < 2) return null;
        
        // Don't respond to very short messages unless they're questions
        if (cleanMsg.length < 5 && !cleanMsg.endsWith('?')) return null;
        
        // Try API 1
        try {
            const res1 = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(cleanMsg)}&lc=sw`, {
                timeout: 5000
            });
            if (res1.data?.success) {
                return res1.data.success;
            }
        } catch (e) {}
        
        // Try API 2
        try {
            const res2 = await axios.get(`https://api.akuari.my.id/simi/simi2?query=${encodeURIComponent(cleanMsg)}`, {
                timeout: 5000
            });
            if (res2.data?.success) {
                return res2.data.success;
            }
        } catch (e) {}
        
        // Try API 3
        try {
            const res3 = await axios.get(`https://api.betabotz.org/api/simi?text=${encodeURIComponent(cleanMsg)}&apikey=beta-ryuuki`, {
                timeout: 5000
            });
            if (res3.data?.result) {
                return res3.data.result;
            }
        } catch (e) {}
        
        // If all APIs fail, return null (silent fail)
        return null;
        
    } catch (error) {
        // Silent fail - return null
        return null;
    }
}

// ✅ **WELCOME & GOODBYE - PROPER WORKING**
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    try {
        // Check if bot is admin
        const botAdmin = await isBotAdmin(conn, groupJid);
        if (!botAdmin) return;
        
        // Get participant and group info
        const participantName = await getContactName(conn, participant);
        const groupName = await getGroupName(conn, groupJid);
        const username = getUsername(participant);
        
        if (action === 'add') {
            // Welcome message
            const welcomeMsg = `
🎉 *WELCOME TO THE GROUP!*

👤 *New Member:* ${participantName}
📞 *Phone:* ${username}
🏷️ *Group:* ${groupName}
🕐 *Joined:* ${new Date().toLocaleTimeString()}

✨ *Welcome to our community!*
💬 Feel free to introduce yourself
📜 Please read the group rules
🎯 Enjoy your stay with us!`;
            
            await conn.sendMessage(groupJid, { 
                text: welcomeMsg,
                mentions: [participant]
            });
            
        } else if (action === 'remove') {
            // Goodbye message
            const goodbyeMsg = `
👋 *GOODBYE!*

👤 *Member:* ${participantName}
📞 *Phone:* ${username}
🏷️ *Group:* ${groupName}
🕐 *Left:* ${new Date().toLocaleTimeString()}

😢 We'll miss you!
💔 Hope to see you again soon`;
            
            await conn.sendMessage(groupJid, { text: goodbyeMsg });
        }
        
    } catch (error) {
        console.error('Welcome/Goodbye error:', error.message);
    }
}

// ✅ **COMMAND LOADER (FOR YOUR EXISTING COMMANDS)**
async function loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup) {
    try {
        const reply = createReply(conn, from, msg);
        
        // First check if command exists in our commands folder
        const commandsPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(commandsPath)) {
            await reply("❌ Commands folder not found");
            return;
        }
        
        // Search for command file in all subfolders
        let commandFile = null;
        const categories = fs.readdirSync(commandsPath);
        
        for (const category of categories) {
            const categoryPath = path.join(commandsPath, category);
            if (!fs.statSync(categoryPath).isDirectory()) continue;
            
            // Check for .js file
            const filePath = path.join(categoryPath, `${command}.js`);
            if (fs.existsSync(filePath)) {
                commandFile = filePath;
                break;
            }
        }
        
        if (!commandFile) {
            await reply(`❌ Command "${command}" not found`);
            return;
        }
        
        // Load the command module
        delete require.cache[require.resolve(commandFile)];
        const cmdModule = require(commandFile);
        
        // Prepare execution parameters
        const execParams = {
            conn,
            msg,
            args,
            from,
            sender,
            isGroup,
            isOwner,
            pushname,
            reply: createReply(conn, from, msg),
            fancy
        };
        
        // Execute based on module structure
        if (typeof cmdModule.execute === 'function') {
            await cmdModule.execute(execParams);
        } else if (typeof cmdModule === 'function') {
            await cmdModule(execParams);
        } else if (cmdModule.run) {
            await cmdModule.run(execParams);
        } else {
            await reply(`❌ Invalid command format for "${command}"`);
        }
        
    } catch (error) {
        console.error(`Command "${command}" error:`, error);
        try {
            const reply = createReply(conn, from, msg);
            await reply(`❌ Command error: ${error.message}`);
        } catch (e) {}
    }
}

// ✅ **MAIN MESSAGE HANDLER**
module.exports = async (conn, m) => {
    try {
        if (!m.messages || !m.messages[0] || !m.messages[0].message) return;
        const msg = m.messages[0];
        
        // Check if bot is properly initialized
        if (!conn.user?.id) {
            console.error("Bot not initialized properly");
            return;
        }
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "User";
        const isGroup = from.endsWith('@g.us');
        
        // Extract message body
        let body = '';
        if (msg.message.conversation) {
            body = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
            body = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage?.caption) {
            body = msg.message.imageMessage.caption || '';
        } else if (msg.message.videoMessage?.caption) {
            body = msg.message.videoMessage.caption || '';
        }
        
        // Check if sender is owner
        const isOwner = config.ownerNumber?.some(num => {
            const cleanNum = num.toString().replace(/[^0-9]/g, '');
            const cleanSender = getUsername(sender);
            return cleanSender.includes(cleanNum) || sender === conn.user.id;
        }) || false;
        
        // ✅ **AUTO TYPING**
        await handleAutoTyping(conn, from);
        
        // ✅ **AUTO RECORDING**
        await handleAutoRecording(conn, msg);
        
        // ✅ **STORE MESSAGE FOR ANTI DELETE**
        storeMessage(msg);
        
        // ✅ **ANTI VIEW ONCE**
        if (await handleViewOnce(conn, msg)) return;
        
        // ✅ **ANTI DELETE**
        if (await handleAntiDelete(conn, msg)) return;
        
        // ✅ **AUTO READ**
        try {
            await conn.readMessages([msg.key]);
        } catch (e) {}
        
        // ✅ **AUTO REACT**
        if (!msg.key.fromMe) {
            try {
                const reactions = ['❤️', '👍', '🔥', '🎉', '😊', '👏'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                await conn.sendMessage(from, {
                    react: {
                        text: randomReaction,
                        key: msg.key
                    }
                });
            } catch (e) {}
        }
        
        // ✅ **CHECK FOR COMMANDS**
        let isCmd = false;
        let command = '';
        let args = [];
        
        if (body && typeof body === 'string') {
            const prefix = config.prefix || '.';
            if (body.startsWith(prefix)) {
                isCmd = true;
                const cmdText = body.slice(prefix.length).trim();
                const parts = cmdText.split(/ +/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }
        
        // ✅ **ANTI LINK CHECK**
        if (isGroup && body && !msg.key.fromMe) {
            const reply = createReply(conn, from, msg);
            if (await checkAntiLink(conn, msg, body, from, sender, reply)) return;
        }
        
        // ✅ **HANDLE COMMANDS**
        if (isCmd && command) {
            await loadCommand(command, conn, from, msg, args, isOwner, sender, pushname, isGroup);
            return;
        }
        
        // ✅ **AUTO AI RESPONSE (SILENT ON FAIL)**
        if (body && !isCmd && !msg.key.fromMe) {
            // Check if message is for bot
            const botName = config.botName?.toLowerCase() || 'bot';
            const isForBot = body.toLowerCase().includes(botName) || 
                            body.endsWith('?') || 
                            ['hi', 'hello', 'hey', 'hallo', 'habari', 'mambo', 'niaje', 'sasa', 'niaje bro'].some(word => 
                                body.toLowerCase().startsWith(word)
                            );
            
            if (isForBot) {
                try {
                    // Show typing
                    await conn.sendPresenceUpdate('composing', from);
                    
                    // Get AI response
                    const aiResponse = await getAIResponse(body);
                    
                    // Only send if we got a response
                    if (aiResponse) {
                        await conn.sendMessage(from, { text: aiResponse });
                    }
                    
                    // Stop typing
                    await conn.sendPresenceUpdate('paused', from);
                } catch (e) {
                    // Silent fail - don't send anything
                    try {
                        await conn.sendPresenceUpdate('paused', from);
                    } catch (e2) {}
                }
                return;
            }
        }
        
    } catch (err) {
        console.error("Handler Error:", err.message);
    }
};

// ✅ **GROUP UPDATE HANDLER**
module.exports.handleGroupUpdate = async (conn, update) => {
    try {
        const { id, participants, action } = update;
        
        if (action === 'add' || action === 'remove') {
            for (const participant of participants) {
                await handleWelcome(conn, participant, id, action);
            }
        }
    } catch (error) {
        console.error("Group update error:", error.message);
    }
};

// ✅ **INITIALIZATION**
module.exports.init = async (conn) => {
    try {
        console.log('[SYSTEM] 🔥 Initializing INSIDIOUS: THE LAST KEY...');
        
        if (conn.user?.id) {
            console.log(`[BOT] Name: ${conn.user.name || "INSIDIOUS"}`);
            console.log(`[BOT] Number: ${conn.user.id.split(':')[0] || "Unknown"}`);
            
            // Set initial bio
            try {
                await conn.updateProfileStatus('🤖 INSIDIOUS: THE LAST KEY | 👑 STANYTZ | ⚡ ONLINE');
            } catch (e) {}
        }
        
        console.log('[SYSTEM] ✅ All features initialized and working');
        console.log('[SYSTEM] 🤖 Auto AI: ACTIVE (Silent on fail)');
        console.log('[SYSTEM] 🛡️ Anti Features: WORKING');
        console.log('[SYSTEM] ⚡ Auto Typing/Recording: ACTIVE');
        console.log('[SYSTEM] 👋 Welcome/Goodbye: WORKING');
        
    } catch (error) {
        console.error('Init error:', error.message);
    }
};
