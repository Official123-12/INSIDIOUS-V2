const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// ==================== LOAD CONFIG ====================
let config = {};
try {
    config = require('./config');
} catch {
    config = {};
}

// -------------------- NORMALIZE OWNER NUMBERS --------------------
config.ownerNumber = (config.ownerNumber || [])
    .map(num => num.replace(/[^0-9]/g, ''))
    .filter(num => num.length >= 10);

// -------------------- DEFAULT SETTINGS (FALLBACK) --------------------
const DEFAULT_SETTINGS = {
    // ANTI FEATURES
    antilink: true,
    antiporn: true,
    antiscam: true,
    antitag: true,
    antiviewonce: true,
    antidelete: true,
    
    // AUTOMATION
    autoRead: true,
    autoReact: true,
    autoTyping: true,
    autoRecording: true,
    autoBio: true,
    
    // GROUP
    welcomeGoodbye: true,
    
    // AI
    chatbot: true,
    
    // PAIRING
    maxCoOwners: 2,
    
    // BOT MODE
    mode: 'public' // 'public' or 'self'
};

// ==================== SETTINGS MANAGEMENT ====================
const SETTINGS_FILE = path.join(__dirname, '.settings.json');

async function loadSettings() {
    try {
        if (await fs.pathExists(SETTINGS_FILE)) {
            const saved = await fs.readJson(SETTINGS_FILE);
            return { ...DEFAULT_SETTINGS, ...saved };
        }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings) {
    await fs.writeJson(SETTINGS_FILE, settings, { spaces: 2 });
}

// Merge settings into config object
let settingsCache = null;
async function refreshConfig() {
    settingsCache = await loadSettings();
    Object.assign(config, settingsCache);
}
refreshConfig(); // initial load

// ==================== FANCY FUNCTION ====================
let fancy = (text) => text;
try {
    fancy = require('./lib/tools').fancy;
} catch {
    fancy = function(text) {
        if (!text || typeof text !== 'string') return text;
        const fancyMap = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
        };
        return text.split('').map(c => fancyMap[c] || c).join('');
    };
}

// ==================== PAIRING SYSTEM (WHATSAPP ONLY) ====================
const PAIR_FILE = path.join(__dirname, '.paired.json');
let pairedNumbers = new Set();
let botSecretId = null;

function generateBotId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'INS';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

async function loadPairedNumbers() {
    try {
        if (await fs.pathExists(PAIR_FILE)) {
            const data = await fs.readJson(PAIR_FILE);
            pairedNumbers = new Set(data.paired || []);
            botSecretId = data.botId || generateBotId();
        } else {
            botSecretId = generateBotId();
            await savePairedNumbers();
        }
    } catch {
        pairedNumbers = new Set();
        botSecretId = generateBotId();
    }
    // Deployer always paired
    config.ownerNumber.forEach(num => {
        if (num) pairedNumbers.add(num);
    });
}

async function savePairedNumbers() {
    const data = {
        botId: botSecretId,
        paired: Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n))
    };
    await fs.writeJson(PAIR_FILE, data, { spaces: 2 });
}

function canPairNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    if (config.ownerNumber.includes(clean)) return false;
    const nonOwnerPaired = Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n));
    return nonOwnerPaired.length < config.maxCoOwners && !pairedNumbers.has(clean);
}

async function pairNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    if (!canPairNumber(clean)) return false;
    pairedNumbers.add(clean);
    await savePairedNumbers();
    return true;
}

async function unpairNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    if (config.ownerNumber.includes(clean)) return false;
    const deleted = pairedNumbers.delete(clean);
    if (deleted) await savePairedNumbers();
    return deleted;
}

function getPairedNumbers() {
    return Array.from(pairedNumbers);
}

function isDeployer(number) {
    const clean = number.replace(/[^0-9]/g, '');
    return config.ownerNumber.includes(clean);
}

function isCoOwner(number) {
    const clean = number.replace(/[^0-9]/g, '');
    return pairedNumbers.has(clean) && !config.ownerNumber.includes(clean);
}

// ==================== STORAGE FOR ANTI-DELETE & WARNINGS ====================
const messageStore = new Map();
const warningTracker = new Map();
const userActivity = new Map();

// ==================== HELPER FUNCTIONS ====================
function getUsername(jid) {
    if (!jid) return 'Unknown';
    return jid.split('@')[0] || 'Unknown';
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
        return metadata.subject || 'Group';
    } catch {
        return 'Group';
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

// ==================== AUTO FEATURES ====================
async function handleAutoTyping(conn, from) {
    if (!config.autoTyping) return;
    try {
        await conn.sendPresenceUpdate('composing', from);
        setTimeout(async () => {
            await conn.sendPresenceUpdate('paused', from);
        }, 2000);
    } catch (e) {}
}

async function handleAutoRecording(conn, msg) {
    if (!config.autoRecording) return;
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        if (!userActivity.has(sender)) userActivity.set(sender, []);
        userActivity.get(sender).push({
            timestamp: new Date(),
            type: msg.message?.imageMessage ? 'image' :
                  msg.message?.videoMessage ? 'video' :
                  msg.message?.audioMessage ? 'audio' : 'text'
        });
        if (userActivity.get(sender).length > 100) userActivity.get(sender).shift();
    } catch (e) {}
}

// ==================== ANTI-DELETE STORAGE ====================
function storeMessage(msg) {
    try {
        if (!msg.key?.id || msg.key.fromMe) return;
        let content = '';
        if (msg.message?.conversation) content = msg.message.conversation;
        else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
        else if (msg.message?.imageMessage?.caption) content = msg.message.imageMessage.caption || '';
        else if (msg.message?.videoMessage?.caption) content = msg.message.videoMessage.caption || '';
        if (content) {
            messageStore.set(msg.key.id, {
                content,
                sender: msg.key.participant || msg.key.remoteJid,
                timestamp: new Date()
            });
            if (messageStore.size > 1000) {
                const keys = Array.from(messageStore.keys()).slice(0, 200);
                keys.forEach(key => messageStore.delete(key));
            }
        }
    } catch (e) {}
}

// ==================== WELCOME/GOODBYE ====================
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    try {
        if (!config.welcomeGoodbye) return;
        const botAdmin = await isBotAdmin(conn, groupJid);
        if (!botAdmin) return;
        const participantName = await getContactName(conn, participant);
        const groupName = await getGroupName(conn, groupJid);
        if (action === 'add') {
            const welcomeMsg = `
🎉 *WELCOME TO ${groupName.toUpperCase()}!*

👤 New Member: ${participantName}
📞 Phone: ${getUsername(participant)}
🕐 Joined: ${new Date().toLocaleTimeString()}

💬 Welcome to our community!`;
            await conn.sendMessage(groupJid, { text: welcomeMsg, mentions: [participant] });
        } else {
            const goodbyeMsg = `
👋 *GOODBYE!*

👤 Member: ${participantName}
📞 Phone: ${getUsername(participant)}
🕐 Left: ${new Date().toLocaleTimeString()}

😢 We'll miss you!`;
            await conn.sendMessage(groupJid, { text: goodbyeMsg });
        }
    } catch (e) {}
}

// ==================== AUTO-FOLLOW CHANNELS ====================
async function autoFollowChannels(conn) {
    const channels = config.autoFollowChannels || [];
    for (const channel of channels) {
        try {
            if (!channel) continue;
            const inviteCode = channel.split('@')[0];
            await conn.groupAcceptInvite(inviteCode);
            console.log(fancy(`✅ Auto‑joined channel: ${channel}`));
        } catch (e) {}
    }
}

// ==================== WELCOME MESSAGE TO DEPLOYER ====================
async function sendWelcomeToDeployer(conn) {
    if (!config.ownerNumber.length) return;
    const deployerNum = config.ownerNumber[0];
    if (deployerNum.length < 10) return;
    const jid = deployerNum + '@s.whatsapp.net';
    try {
        const botNumber = conn.user?.id?.split(':')[0] || 'Unknown';
        const msg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${config.botName || 'INSIDIOUS'}
📞 *Number:* ${botNumber}
🔐 *Bot ID:* ${botSecretId}
👥 *Co‑owners:* ${Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n)).length}/${config.maxCoOwners}

⚡ *Status:* ONLINE & ACTIVE

📊 *ALL FEATURES ACTIVE:*
🛡️ Anti Link / Scam / Porn / Tag / Crash
🗑️ Anti Delete / ViewOnce
🤖 AI Chatbot
📢 Auto‑Follow Channels
❤️ Auto‑React to Channel Posts
👀 Auto Read / Auto React
⚡ Auto Typing / Recording
🎉 Welcome/Goodbye

👑 *Deployer:* ${config.ownerName || 'STANY'}
💾 *Version:* 2.1.1 | Year: 2025
`;
        await conn.sendMessage(jid, {
            image: { url: config.aliveImage || 'https://files.catbox.moe/mfngio.png' },
            caption: msg,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                    newsletterName: config.botName || 'INSIDIOUS'
                }
            }
        });
    } catch (e) {
        console.log(fancy('⚠️ Could not send welcome message'), e.message);
    }
}

// ==================== ANTI FEATURES WITH WARNING SYSTEM ====================
async function handleAntiLink(conn, msg, body, from, sender, reply) {
    if (!config.antilink || !from.endsWith('@g.us')) return false;
    if (!body.match(/https?:\/\//gi) && !body.match(/chat\.whatsapp\.com/i) && !body.match(/wa\.me/i)) return false;
    
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const senderNumber = sender.split('@')[0];
    const warnings = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warnings);
    
    if (warnings >= 3) {
        await conn.sendMessage(from, { delete: msg.key });
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${senderNumber} removed: Links (3 warnings)`), { mentions: [sender] });
        warningTracker.delete(sender);
    } else {
        await conn.sendMessage(from, { delete: msg.key });
        await reply(fancy(`⚠️ @${senderNumber} links are not allowed! Warning ${warnings}/3`), { mentions: [sender] });
    }
    return true;
}

async function handleAntiScam(conn, msg, body, from, sender, reply) {
    if (!config.antiscam || !from.endsWith('@g.us')) return false;
    if (!config.scamKeywords?.some(w => body.toLowerCase().includes(w))) return false;
    
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const senderNumber = sender.split('@')[0];
    const warnings = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warnings);
    
    await conn.sendMessage(from, { delete: msg.key });
    const meta = await conn.groupMetadata(from);
    
    if (warnings >= 3) {
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${senderNumber} removed: Scam (3 warnings)`), { mentions: meta.participants.map(p => p.id) });
        warningTracker.delete(sender);
    } else {
        await reply(fancy(`⚠️ SCAM ALERT! @${senderNumber} – Warning ${warnings}/3`), { mentions: meta.participants.map(p => p.id) });
    }
    return true;
}

async function handleAntiPorn(conn, msg, body, from, sender, reply) {
    if (!config.antiporn || !from.endsWith('@g.us')) return false;
    if (!config.pornKeywords?.some(w => body.toLowerCase().includes(w))) return false;
    
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const senderNumber = sender.split('@')[0];
    const warnings = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warnings);
    
    await conn.sendMessage(from, { delete: msg.key });
    
    if (warnings >= 3) {
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${senderNumber} removed: Adult content (3 warnings)`), { mentions: [sender] });
        warningTracker.delete(sender);
    } else {
        await reply(fancy(`⚠️ @${senderNumber} adult content is forbidden! Warning ${warnings}/3`), { mentions: [sender] });
    }
    return true;
}

async function handleAntiTag(conn, msg, from, sender, reply) {
    if (!config.antitag || !from.endsWith('@g.us')) return false;
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentions || mentions.length < 5) return false; // allow up to 5 tags
    
    const botAdmin = await isBotAdmin(conn, from);
    if (!botAdmin) return false;
    
    const senderNumber = sender.split('@')[0];
    const warnings = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warnings);
    
    await conn.sendMessage(from, { delete: msg.key });
    
    if (warnings >= 3) {
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${senderNumber} removed: Excessive tagging (3 warnings)`), { mentions: [sender] });
        warningTracker.delete(sender);
    } else {
        await reply(fancy(`⚠️ @${senderNumber} don't tag too many people! Warning ${warnings}/3`), { mentions: [sender] });
    }
    return true;
}

// ==================== ANTI VIEW ONCE / ANTI DELETE ====================
async function handleViewOnce(conn, msg) {
    if (!config.antiviewonce) return false;
    const viewOnceMsg = msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage;
    if (!viewOnceMsg) return false;
    
    for (const ownerNum of config.ownerNumber) {
        const jid = ownerNum + '@s.whatsapp.net';
        await conn.sendMessage(jid, {
            forward: msg,
            caption: fancy('ɪɴꜱɪᴅɪᴏᴜꜱ ᴠɪᴇᴡ ᴏɴᴄᴇ ʀᴇᴄᴏᴠᴇʀʏ')
        });
    }
    return true;
}

async function handleAntiDelete(conn, msg) {
    if (!config.antidelete) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) return false;
    
    const deletedKey = msg.message.protocolMessage.key;
    const stored = messageStore.get(deletedKey.id);
    if (!stored) return false;
    
    for (const ownerNum of config.ownerNumber) {
        const jid = ownerNum + '@s.whatsapp.net';
        await conn.sendMessage(jid, {
            text: `🗑️ *DELETED MESSAGE RECOVERED*\n\nFrom: @${stored.sender.split('@')[0]}\nMessage: ${stored.content}`,
            mentions: [stored.sender]
        });
    }
    messageStore.delete(deletedKey.id);
    return true;
}

// ==================== AUTO-REACT TO CHANNEL POSTS ====================
async function autoReactToChannel(conn, msg, from) {
    if (!from.endsWith('@newsletter') || msg.key.fromMe) return;
    const reactions = ['❤️', '🔥', '👍', '🎉', '👏', '⚡', '✨', '🌟'];
    const randomEmoji = reactions[Math.floor(Math.random() * reactions.length)];
    try {
        await conn.sendMessage(from, { react: { text: randomEmoji, key: msg.key } });
        console.log(fancy(`✅ Auto‑reacted ${randomEmoji} to channel post`));
    } catch (e) {}
}

// ==================== AI CHATBOT ====================
async function handleChatbot(conn, msg, from, body) {
    if (!config.chatbot) return false;
    if (msg.key.fromMe || from.endsWith('@g.us')) return false;
    await conn.sendPresenceUpdate('composing', from);
    try {
        const ai = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(body)}?system=You are INSIDIOUS V2. Reply humanly in user language.`);
        await conn.sendMessage(from, {
            text: fancy(ai.data),
            contextInfo: {
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                    newsletterName: config.botName || 'INSIDIOUS'
                }
            }
        }, { quoted: msg });
        return true;
    } catch (e) {
        return false;
    }
}

// ==================== CRASH PROTECTION ====================
async function handleCrashAttempt(conn, msg, body, from, sender, isOwner) {
    if (body.length > 25000 && !isOwner) {
        await conn.sendMessage(from, { delete: msg.key });
        if (from.endsWith('@g.us')) await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await conn.updateBlockStatus(sender, 'block');
        console.log(fancy(`🥀 BLOCKED CRASH ATTEMPT FROM: ${sender.split('@')[0]}`));
        return true;
    }
    return false;
}

// ==================== INIT ====================
module.exports.init = async (conn) => {
    console.log(fancy('[SYSTEM] Initializing INSIDIOUS...'));
    await refreshConfig();
    await loadPairedNumbers();
    console.log(fancy(`🔐 Bot ID: ${botSecretId}`));
    console.log(fancy(`📋 Co‑owners: ${Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n)).length}/${config.maxCoOwners}`));
    console.log(fancy(`⚙️ Mode: ${config.mode?.toUpperCase() || 'PUBLIC'}`));
    await autoFollowChannels(conn);
    await sendWelcomeToDeployer(conn);
    console.log(fancy('[SYSTEM] ✅ All systems ready'));
};

// ==================== MAIN MESSAGE HANDLER ====================
module.exports = async (conn, m) => {
    try {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '').trim();

        // -------------------- OWNER DETECTION --------------------
        const isFromMe = msg.key.fromMe || false;
        const isDeployerUser = isDeployer(senderNumber);
        const isCoOwnerUser = isCoOwner(senderNumber);
        const isOwner = isFromMe || isDeployerUser || isCoOwnerUser;

        const isGroup = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');

        // -------------------- STORE MESSAGE (ANTI-DELETE) --------------------
        storeMessage(msg);

        // -------------------- AUTO FEATURES --------------------
        await handleAutoTyping(conn, from);
        await handleAutoRecording(conn, msg);
        if (config.autoRead) await conn.readMessages([msg.key]);
        if (config.autoReact && !msg.key.fromMe && !isChannel) {
            await conn.sendMessage(from, { react: { text: '🥀', key: msg.key } });
        }

        // -------------------- AUTO-REACT TO CHANNELS --------------------
        await autoReactToChannel(conn, msg, from);

        // -------------------- CRASH PROTECTION --------------------
        if (await handleCrashAttempt(conn, msg, body, from, sender, isOwner)) return;

        // -------------------- ANTI VIEW ONCE / ANTI DELETE --------------------
        await handleViewOnce(conn, msg);
        await handleAntiDelete(conn, msg);

        // -------------------- COMMAND HANDLER --------------------
        const prefix = config.prefix || '.';
        if (body.startsWith(prefix)) {
            const commandName = body.slice(prefix.length).trim().split(' ')[0].toLowerCase();
            const args = body.trim().split(/ +/).slice(1);

            // Search for command in categories
            const commandsPath = path.join(__dirname, 'commands');
            if (!await fs.pathExists(commandsPath)) return;
            
            const categories = await fs.readdir(commandsPath);
            let commandFile = null;
            let cmdModule = null;

            for (const cat of categories) {
                const catPath = path.join(commandsPath, cat);
                if (!(await fs.stat(catPath)).isDirectory()) continue;
                const filePath = path.join(catPath, `${commandName}.js`);
                if (await fs.pathExists(filePath)) {
                    commandFile = filePath;
                    break;
                }
            }

            if (!commandFile) {
                return conn.sendMessage(from, { text: fancy(`❌ Command "${commandName}" not found`) }, { quoted: msg });
            }

            delete require.cache[require.resolve(commandFile)];
            cmdModule = require(commandFile);

            // -------------------- PERMISSION CHECK --------------------
            const isOwnerOnly = cmdModule.ownerOnly || false;
            if (isOwnerOnly && !isOwner) {
                return conn.sendMessage(from, { text: fancy('❌ This command is for owner only!') }, { quoted: msg });
            }

            // -------------------- MODE CHECK (PUBLIC/SELF) --------------------
            if (config.mode === 'self' && !isOwner && !isOwnerOnly) {
                // in self mode, only owners can use any command
                return;
            }

            // -------------------- EXECUTE COMMAND --------------------
            try {
                await cmdModule.execute(conn, msg, args, {
                    from,
                    sender,
                    fancy,
                    config,
                    isOwner,
                    isDeployer: isDeployerUser,
                    isCoOwner: isCoOwnerUser,
                    reply: async (text, options = {}) => {
                        return await conn.sendMessage(from, { text, ...options }, { quoted: msg });
                    },
                    // Pairing utilities
                    botId: botSecretId,
                    canPairNumber,
                    pairNumber,
                    unpairNumber,
                    getPairedNumbers
                });
            } catch (e) {
                console.error(`Command error (${commandName}):`, e);
                await conn.sendMessage(from, { text: fancy(`❌ Command error: ${e.message}`) }, { quoted: msg });
            }
            return;
        }

        // -------------------- GROUP SECURITY (ONLY NON-OWNERS) --------------------
        if (isGroup && !isOwner) {
            if (await handleAntiLink(conn, msg, body, from, sender, async (text, options) => {
                return await conn.sendMessage(from, { text, ...options }, { quoted: msg });
            })) return;
            
            if (await handleAntiScam(conn, msg, body, from, sender, async (text, options) => {
                return await conn.sendMessage(from, { text, ...options }, { quoted: msg });
            })) return;
            
            if (await handleAntiPorn(conn, msg, body, from, sender, async (text, options) => {
                return await conn.sendMessage(from, { text, ...options }, { quoted: msg });
            })) return;
            
            if (await handleAntiTag(conn, msg, from, sender, async (text, options) => {
                return await conn.sendMessage(from, { text, ...options }, { quoted: msg });
            })) return;
        }

        // -------------------- AI CHATBOT (PRIVATE ONLY) --------------------
        if (!isGroup && body && !msg.key.fromMe && !body.startsWith(prefix)) {
            await handleChatbot(conn, msg, from, body);
        }

    } catch (err) {
        console.error(fancy('❌ Handler Error:'), err.message);
    }
};

// ==================== GROUP UPDATE HANDLER ====================
module.exports.handleGroupUpdate = async (conn, update) => {
    try {
        const { id, participants, action } = update;
        if (action === 'add' || action === 'remove') {
            for (const participant of participants) {
                await handleWelcome(conn, participant, id, action);
            }
        }
    } catch (error) {
        console.error('Group update error:', error.message);
    }
};

// ==================== EXPORT UTILITIES ====================
module.exports.pairNumber = pairNumber;
module.exports.unpairNumber = unpairNumber;
module.exports.getPairedNumbers = getPairedNumbers;
module.exports.getBotId = () => botSecretId;
module.exports.isDeployer = isDeployer;
module.exports.isCoOwner = isCoOwner;
module.exports.canPairNumber = canPairNumber;
module.exports.loadSettings = loadSettings;
module.exports.saveSettings = saveSettings;
module.exports.refreshConfig = refreshConfig;
