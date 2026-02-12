const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// ==================== LOAD CONFIG ====================
let config = {};
try { config = require('./config'); } catch { config = {}; }

config.ownerNumber = (config.ownerNumber || [])
    .map(num => num.replace(/[^0-9]/g, ''))
    .filter(num => num.length >= 10);

// ==================== DEFAULT SETTINGS (ALL FEATURES ON) ====================
const DEFAULT_SETTINGS = {
    // ANTI FEATURES
    antilink: true,
    antiporn: true,
    antiscam: true,
    antitag: true,
    antiviewonce: true,
    antidelete: true,
    // AUTO FEATURES
    autoRead: true,
    autoReact: true,
    autoTyping: true,
    autoRecording: true,
    autoBio: true,
    // GROUP FEATURES
    welcomeGoodbye: true,
    // AI FEATURES
    chatbot: true,
    // PAIRING
    maxCoOwners: 2,
    // BOT MODE
    mode: 'public'  // 'public' or 'self'
};

// ==================== SETTINGS MANAGEMENT ====================
const SETTINGS_FILE = path.join(__dirname, '.settings.json');

async function loadSettings() {
    try {
        if (await fs.pathExists(SETTINGS_FILE)) {
            const saved = await fs.readJson(SETTINGS_FILE);
            return { ...DEFAULT_SETTINGS, ...saved };
        }
    } catch {}
    return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings) {
    await fs.writeJson(SETTINGS_FILE, settings, { spaces: 2 });
}

let settingsCache = null;
async function refreshConfig() {
    settingsCache = await loadSettings();
    Object.assign(config, settingsCache);
}
// initial load
refreshConfig();

// ==================== FANCY FUNCTION ====================
let fancy = (text) => text;
try {
    const { fancy: f } = require('./lib/tools');
    if (f) fancy = f;
} catch {
    fancy = (text) => {
        if (!text || typeof text !== 'string') return text;
        const map = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
        };
        return text.split('').map(c => map[c] || c).join('');
    };
}

// ==================== PAIRING SYSTEM ====================
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
    config.ownerNumber.forEach(num => num && pairedNumbers.add(num));
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

// ==================== STORAGE ====================
const messageStore = new Map();
const warningTracker = new Map();
const userActivity = new Map();

// ==================== HELPER FUNCTIONS ====================
function getUsername(jid) { return jid?.split('@')[0] || 'Unknown'; }

async function getContactName(conn, jid) {
    try {
        const contact = await conn.getContact(jid);
        return contact?.name || contact?.pushname || getUsername(jid);
    } catch { return getUsername(jid); }
}

async function getGroupName(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        return meta.subject || 'Group';
    } catch { return 'Group'; }
}

async function isBotAdmin(conn, groupJid) {
    try {
        if (!conn.user?.id) return false;
        const meta = await conn.groupMetadata(groupJid);
        return meta.participants.some(p => p.id === conn.user.id && (p.admin === 'admin' || p.admin === 'superadmin'));
    } catch { return false; }
}

// ==================== ENHANCE MESSAGE WITH .reply() ====================
function enhanceMessage(conn, msg) {
    if (!msg) return msg;
    if (!msg.reply) {
        msg.reply = async (text, options = {}) => {
            try {
                return await conn.sendMessage(msg.key.remoteJid, { text, ...options }, { quoted: msg });
            } catch (e) { return null; }
        };
    }
    return msg;
}

// ==================== AUTO FEATURES ====================
async function handleAutoTyping(conn, from) {
    if (!config.autoTyping) return;
    try {
        await conn.sendPresenceUpdate('composing', from);
        setTimeout(() => conn.sendPresenceUpdate('paused', from), 2000);
    } catch {}
}

async function handleAutoRecording(conn, msg) {
    if (!config.autoRecording) return;
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        if (!userActivity.has(sender)) userActivity.set(sender, []);
        userActivity.get(sender).push({
            timestamp: new Date(),
            type: msg.message?.imageMessage ? 'image' : msg.message?.videoMessage ? 'video' : msg.message?.audioMessage ? 'audio' : 'text'
        });
        if (userActivity.get(sender).length > 100) userActivity.get(sender).shift();
    } catch {}
}

// ==================== STORE MESSAGE (ANTI-DELETE) ====================
function storeMessage(msg) {
    try {
        if (!msg.key?.id || msg.key.fromMe) return;
        const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
        if (content) {
            messageStore.set(msg.key.id, { content, sender: msg.key.participant || msg.key.remoteJid, timestamp: new Date() });
            if (messageStore.size > 1000) Array.from(messageStore.keys()).slice(0, 200).forEach(k => messageStore.delete(k));
        }
    } catch {}
}

// ==================== WELCOME/GOODBYE ====================
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    if (!config.welcomeGoodbye) return;
    const isAdmin = await isBotAdmin(conn, groupJid);
    if (!isAdmin) return;
    const name = await getContactName(conn, participant);
    const group = await getGroupName(conn, groupJid);
    const text = action === 'add'
        ? `🎉 *WELCOME TO ${group.toUpperCase()}!*\n\n👤 New Member: ${name}\n📞 Phone: ${getUsername(participant)}\n🕐 Joined: ${new Date().toLocaleTimeString()}\n\n💬 Welcome to our community!`
        : `👋 *GOODBYE!*\n\n👤 Member: ${name}\n📞 Phone: ${getUsername(participant)}\n🕐 Left: ${new Date().toLocaleTimeString()}\n\n😢 We'll miss you!`;
    await conn.sendMessage(groupJid, { text, mentions: action === 'add' ? [participant] : [] });
}

// ==================== AUTO-FOLLOW CHANNELS ====================
async function autoFollowChannels(conn) {
    const channels = config.autoFollowChannels || [];
    for (const ch of channels) {
        try { if (ch) await conn.groupAcceptInvite(ch.split('@')[0]); } catch {}
    }
}

// ==================== WELCOME DEPLOYER ====================
async function sendWelcomeToDeployer(conn) {
    if (!config.ownerNumber.length) return;
    const num = config.ownerNumber[0];
    if (num.length < 10) return;
    const jid = num + '@s.whatsapp.net';
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
🌐 *Mode:* ${config.mode?.toUpperCase() || 'PUBLIC'}
⚡ *Status:* ONLINE & ACTIVE

📊 *ALL FEATURES:* ACTIVE

👑 *Deployer:* ${config.ownerName || 'STANY'}
💾 *Version:* 2.1.1 | Year: 2025
`;
        await conn.sendMessage(jid, {
            image: { url: config.aliveImage || config.botImage || 'https://files.catbox.moe/mfngio.png' },
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
    } catch {}
}

// ==================== ANTI FEATURES (REAL DELETE + KICK) ====================
async function handleAntiLink(conn, msg, body, from, sender, reply) {
    if (!from.endsWith('@g.us')) return false;
    await refreshConfig(); // use latest setting
    if (!config.antilink) return false;

    // Comprehensive link regex
    const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-\/a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    if (!linkRegex.test(body)) return false;

    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) {
        await reply(fancy(`⚠️ *Bot not admin!* Promote me to admin to delete links.`));
        return false;
    }

    const warn = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warn);

    // Delete the offending message
    try {
        await conn.sendMessage(from, { delete: msg.key });
    } catch (e) {
        console.error('Delete failed:', e);
    }

    if (warn >= 3) {
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${sender.split('@')[0]} removed: Links (3 warnings)`), { mentions: [sender] });
        warningTracker.delete(sender);
    } else {
        await reply(fancy(`⚠️ @${sender.split('@')[0]} links are not allowed! Warning ${warn}/3`), { mentions: [sender] });
    }
    return true;
}

async function handleAntiScam(conn, msg, body, from, sender, reply) {
    if (!from.endsWith('@g.us')) return false;
    await refreshConfig();
    if (!config.antiscam) return false;
    if (!config.scamKeywords?.some(w => body.toLowerCase().includes(w))) return false;

    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) {
        await reply(fancy(`⚠️ *Bot not admin!* Promote me to admin to delete scam messages.`));
        return false;
    }

    const warn = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warn);
    await conn.sendMessage(from, { delete: msg.key });
    const meta = await conn.groupMetadata(from);
    const allMentions = meta.participants.map(p => p.id);

    if (warn >= 3) {
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${sender.split('@')[0]} removed: Scam (3 warnings)`), { mentions: allMentions });
        warningTracker.delete(sender);
    } else {
        await reply(fancy(`⚠️ SCAM ALERT! @${sender.split('@')[0]} – Warning ${warn}/3`), { mentions: allMentions });
    }
    return true;
}

async function handleAntiPorn(conn, msg, body, from, sender, reply) {
    if (!from.endsWith('@g.us')) return false;
    await refreshConfig();
    if (!config.antiporn) return false;
    if (!config.pornKeywords?.some(w => body.toLowerCase().includes(w))) return false;

    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) {
        await reply(fancy(`⚠️ *Bot not admin!* Promote me to admin to delete adult content.`));
        return false;
    }

    const warn = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warn);
    await conn.sendMessage(from, { delete: msg.key });

    if (warn >= 3) {
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${sender.split('@')[0]} removed: Adult content (3 warnings)`), { mentions: [sender] });
        warningTracker.delete(sender);
    } else {
        await reply(fancy(`⚠️ @${sender.split('@')[0]} adult content is forbidden! Warning ${warn}/3`), { mentions: [sender] });
    }
    return true;
}

async function handleAntiTag(conn, msg, from, sender, reply) {
    if (!from.endsWith('@g.us')) return false;
    await refreshConfig();
    if (!config.antitag) return false;

    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentions || mentions.length < 5) return false; // allow up to 5 tags

    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) {
        await reply(fancy(`⚠️ *Bot not admin!* Promote me to admin to delete excessive tagging.`));
        return false;
    }

    const warn = (warningTracker.get(sender) || 0) + 1;
    warningTracker.set(sender, warn);
    await conn.sendMessage(from, { delete: msg.key });

    if (warn >= 3) {
        await conn.groupParticipantsUpdate(from, [sender], 'remove');
        await reply(fancy(`🚫 @${sender.split('@')[0]} removed: Excessive tagging (3 warnings)`), { mentions: [sender] });
        warningTracker.delete(sender);
    } else {
        await reply(fancy(`⚠️ @${sender.split('@')[0]} don't tag too many people! Warning ${warn}/3`), { mentions: [sender] });
    }
    return true;
}

// ==================== ANTI VIEWONCE & ANTI DELETE ====================
async function handleViewOnce(conn, msg) {
    await refreshConfig();
    if (!config.antiviewonce) return false;
    if (!msg.message?.viewOnceMessageV2 && !msg.message?.viewOnceMessage) return false;
    for (const num of config.ownerNumber) {
        await conn.sendMessage(num + '@s.whatsapp.net', { forward: msg, caption: fancy('ɪɴꜱɪᴅɪᴏᴜꜱ ᴠɪᴇᴡ ᴏɴᴄᴇ ʀᴇᴄᴏᴠᴇʀʏ') });
    }
    return true;
}

async function handleAntiDelete(conn, msg) {
    await refreshConfig();
    if (!config.antidelete) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) return false;
    const stored = messageStore.get(msg.message.protocolMessage.key.id);
    if (!stored) return false;
    for (const num of config.ownerNumber) {
        await conn.sendMessage(num + '@s.whatsapp.net', {
            text: `🗑️ *DELETED MESSAGE RECOVERED*\n\nFrom: @${stored.sender.split('@')[0]}\nMessage: ${stored.content}`,
            mentions: [stored.sender]
        });
    }
    messageStore.delete(msg.message.protocolMessage.key.id);
    return true;
}

// ==================== AUTO-REACT TO CHANNEL ====================
async function autoReactToChannel(conn, msg, from) {
    if (!from.endsWith('@newsletter') || msg.key.fromMe) return;
    const emojis = ['❤️', '🔥', '👍', '🎉', '👏', '⚡', '✨', '🌟'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    try {
        await conn.sendMessage(from, { react: { text: emoji, key: msg.key } });
        console.log(fancy(`✅ Auto‑reacted ${emoji} to channel post`));
    } catch {}
}

// ==================== AI CHATBOT ====================
async function handleChatbot(conn, msg, from, body) {
    await refreshConfig();
    if (!config.chatbot) return false;
    if (msg.key.fromMe || from.endsWith('@g.us')) return false;
    await conn.sendPresenceUpdate('composing', from);
    try {
        const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(body)}?system=You are INSIDIOUS V2. Reply humanly in user language.`);
        await conn.sendMessage(from, {
            text: fancy(res.data),
            contextInfo: {
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                    newsletterName: config.botName || 'INSIDIOUS'
                }
            }
        }, { quoted: msg });
        return true;
    } catch { return false; }
}

// ==================== CRASH PROTECTION ====================
async function handleCrash(conn, msg, body, from, sender, isOwner) {
    if (body.length > 25000 && !isOwner) {
        await conn.sendMessage(from, { delete: msg.key });
        if (from.endsWith('@g.us')) {
            const isAdmin = await isBotAdmin(conn, from);
            if (isAdmin) await conn.groupParticipantsUpdate(from, [sender], 'remove');
        }
        await conn.updateBlockStatus(sender, 'block');
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
    console.log(fancy(`🌐 Mode: ${config.mode?.toUpperCase() || 'PUBLIC'}`));
    await autoFollowChannels(conn);
    await sendWelcomeToDeployer(conn);
    console.log(fancy('[SYSTEM] ✅ All systems ready'));
};

// ==================== MAIN HANDLER ====================
module.exports = async (conn, m) => {
    try {
        if (!m.messages?.[0]) return;
        let msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        // Always use latest settings
        await refreshConfig();

        msg = enhanceMessage(conn, msg);

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        const body = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '').trim();

        const isFromMe = msg.key.fromMe || false;
        const isDeployerUser = isDeployer(senderNumber);
        const isCoOwnerUser = isCoOwner(senderNumber);
        const isOwner = isFromMe || isDeployerUser || isCoOwnerUser;

        const isGroup = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');

        storeMessage(msg);
        await handleAutoTyping(conn, from);
        await handleAutoRecording(conn, msg);
        if (config.autoRead) await conn.readMessages([msg.key]);
        if (config.autoReact && !msg.key.fromMe && !isChannel) {
            await conn.sendMessage(from, { react: { text: '🥀', key: msg.key } });
        }
        await autoReactToChannel(conn, msg, from);
        if (await handleCrash(conn, msg, body, from, sender, isOwner)) return;
        await handleViewOnce(conn, msg);
        await handleAntiDelete(conn, msg);

        const prefix = config.prefix || '.';
        if (body.startsWith(prefix)) {
            const cmdName = body.slice(prefix.length).trim().split(' ')[0].toLowerCase();
            const args = body.split(/ +/).slice(1);
            const cmdPath = path.join(__dirname, 'commands');

            if (await fs.pathExists(cmdPath)) {
                const categories = await fs.readdir(cmdPath);
                let found = false;
                for (const cat of categories) {
                    const catPath = path.join(cmdPath, cat);
                    if (!(await fs.stat(catPath)).isDirectory()) continue;
                    const filePath = path.join(catPath, `${cmdName}.js`);
                    if (await fs.pathExists(filePath)) {
                        delete require.cache[require.resolve(filePath)];
                        const command = require(filePath);

                        // MODE ENFORCEMENT
                        if (config.mode === 'self' && !isOwner) return;

                        if (command.ownerOnly && !isOwner) {
                            await msg.reply(fancy('❌ This command is for owner only!'));
                            return;
                        }

                        try {
                            await command.execute(conn, msg, args, {
                                from,
                                sender,
                                fancy,
                                config,
                                isOwner,
                                isDeployer: isDeployerUser,
                                isCoOwner: isCoOwnerUser,
                                reply: msg.reply,
                                botId: botSecretId,
                                canPairNumber,
                                pairNumber,
                                unpairNumber,
                                getPairedNumbers
                            });
                        } catch (e) {
                            console.error(`Command error (${cmdName}):`, e);
                            await msg.reply(fancy(`❌ Command error: ${e.message}`));
                        }
                        found = true;
                        break;
                    }
                }
                if (!found) await msg.reply(fancy(`❌ Command "${cmdName}" not found`));
            }
            return;
        }

        // GROUP SECURITY – only non‑owners
        if (isGroup && !isOwner) {
            const replyFn = msg.reply;
            if (await handleAntiLink(conn, msg, body, from, sender, replyFn)) return;
            if (await handleAntiScam(conn, msg, body, from, sender, replyFn)) return;
            if (await handleAntiPorn(conn, msg, body, from, sender, replyFn)) return;
            if (await handleAntiTag(conn, msg, from, sender, replyFn)) return;
        }

        // AI CHATBOT – private chat only
        if (!isGroup && body && !msg.key.fromMe && !body.startsWith(prefix)) {
            await handleChatbot(conn, msg, from, body);
        }

    } catch (err) {
        console.error(fancy('❌ Handler Error:'), err.message);
    }
};

// ==================== GROUP UPDATE HANDLER ====================
module.exports.handleGroupUpdate = async (conn, update) => {
    await refreshConfig(); // ensure welcomeGoodbye setting is current
    const { id, participants, action } = update;
    if (action === 'add' || action === 'remove') {
        for (const p of participants) await handleWelcome(conn, p, id, action);
    }
};

// ==================== EXPORTS ====================
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