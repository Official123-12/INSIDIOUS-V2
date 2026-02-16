const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config'); // your config.js

// ==================== TOOLS (Fancy & Runtime) ====================
function fancy(text) {
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
}

function runtime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

// ==================== DEFAULT SETTINGS (FROM CONFIG) ====================
const DEFAULT_SETTINGS = {
    // Bot metadata
    botName: config.botName,
    developer: config.developer,
    version: config.version,
    year: config.year,
    updated: config.updated,
    specialThanks: config.specialThanks,

    // Commands
    prefix: config.prefix,
    mode: config.mode,
    commandWithoutPrefix: config.commandWithoutPrefix,

    // Channel / Group
    newsletterJid: config.newsletterJid,
    requiredGroupJid: config.requiredGroupJid,
    requiredGroupInvite: config.requiredGroupInvite,
    autoFollowChannels: config.autoFollowChannels,

    // Anti / Security
    antilink: config.antilink,
    antiporn: config.antiporn,
    antiscam: config.antiscam,
    antimedia: config.antimedia,
    antitag: config.antitag,
    antiviewonce: config.antiviewonce,
    antidelete: config.antidelete,
    sleepingmode: config.sleepingmode,
    antibugs: config.antibugs,
    antispam: config.antispam,
    anticall: config.anticall,

    // Auto features
    autoRead: config.autoRead,
    autoReact: config.autoReact,
    autoTyping: config.autoTyping,
    autoRecording: config.autoRecording,
    autoBio: config.autoBio,
    autostatus: config.autostatus,
    downloadStatus: config.downloadStatus,

    // Group management
    welcomeGoodbye: config.welcomeGoodbye,
    activemembers: config.activemembers,
    autoblockCountry: config.autoblockCountry,

    // AI
    chatbot: config.chatbot,
    chatbotPrompt: `You are INSIDIOUS AI, a helpful WhatsApp bot assistant. 
You must respond in the SAME LANGUAGE the user uses. 
Be friendly, warm, and human-like. 
Keep responses concise but meaningful. 
If the user speaks broken English, respond in broken English too.
If they speak Swahili, respond in Swahili.
Always be respectful and helpful.`,

    // Thresholds & limits
    warnLimit: config.warnLimit,
    maxTags: config.maxTags,
    inactiveDays: config.inactiveDays,
    antiSpamLimit: config.antiSpamLimit,
    antiSpamInterval: config.antiSpamInterval,
    sleepingStart: config.sleepingStart,
    sleepingEnd: config.sleepingEnd,
    maxCoOwners: config.maxCoOwners,

    // Keywords (arrays)
    scamKeywords: config.scamKeywords,
    pornKeywords: config.pornKeywords,
    blockedMediaTypes: config.blockedMediaTypes,
    blockedCountries: config.blockedCountries,

    // Auto react / status
    autoReactEmojis: config.autoReactEmojis,
    autoStatusActions: config.autoStatusActions,

    // APIs
    quoteApiUrl: config.quoteApiUrl,
    aiApiUrl: config.aiApiUrl,

    // Visuals
    botImage: config.botImage,
    aliveImage: config.aliveImage,
    menuImage: config.menuImage,
    menuAudio: config.menuAudio,
    footer: config.footer,
};

// ==================== GLOBAL & PER-GROUP SETTINGS ====================
const SETTINGS_FILE = path.join(__dirname, '.settings.json');
const GROUP_SETTINGS_FILE = path.join(__dirname, '.groupsettings.json');
let globalSettings = { ...DEFAULT_SETTINGS };
let groupSettings = new Map();

async function loadGlobalSettings() {
    try {
        if (await fs.pathExists(SETTINGS_FILE)) {
            const saved = await fs.readJson(SETTINGS_FILE);
            globalSettings = { ...DEFAULT_SETTINGS, ...saved };
        }
    } catch {}
    return globalSettings;
}
async function saveGlobalSettings() {
    await fs.writeJson(SETTINGS_FILE, globalSettings, { spaces: 2 });
}
async function loadGroupSettings() {
    try {
        if (await fs.pathExists(GROUP_SETTINGS_FILE)) {
            const saved = await fs.readJson(GROUP_SETTINGS_FILE);
            groupSettings = new Map(Object.entries(saved));
        }
    } catch {}
}
async function saveGroupSettings() {
    const obj = Object.fromEntries(groupSettings);
    await fs.writeJson(GROUP_SETTINGS_FILE, obj, { spaces: 2 });
}
function getGroupSetting(groupJid, key) {
    if (!groupJid || groupJid === 'global') return globalSettings[key];
    const gs = groupSettings.get(groupJid) || {};
    return gs[key] !== undefined ? gs[key] : globalSettings[key];
}
async function setGroupSetting(groupJid, key, value) {
    const gs = groupSettings.get(groupJid) || {};
    gs[key] = value;
    groupSettings.set(groupJid, gs);
    await saveGroupSettings();
}
async function refreshConfig() {
    await loadGlobalSettings();
    await loadGroupSettings();
}

// ==================== PAIRING / CO-OWNER SYSTEM ====================
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
    return nonOwnerPaired.length < globalSettings.maxCoOwners && !pairedNumbers.has(clean);
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
const spamTracker = new Map();
const inactiveTracker = new Map();
const statusCache = new Map();
const bugReports = [];

// ==================== HELPER FUNCTIONS ====================
function getUsername(jid) { return jid?.split('@')[0] || 'Unknown'; }

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
async function isParticipantAdmin(conn, groupJid, participantJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const participant = meta.participants.find(p => p.id === participantJid);
        return participant ? (participant.admin === 'admin' || participant.admin === 'superadmin') : false;
    } catch { return false; }
}
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
async function isUserInRequiredGroup(conn, userJid) {
    if (!globalSettings.requiredGroupJid) return true;
    try {
        const groupMeta = await conn.groupMetadata(globalSettings.requiredGroupJid);
        return groupMeta.participants.some(p => p.id === userJid);
    } catch { return false; }
}

// ==================== ACTION APPLIER ====================
async function applyAction(conn, from, sender, actionType, reason, warnIncrement = 1, customMessage = '') {
    if (!from.endsWith('@g.us')) return;
    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) return;

    const mention = [sender];
    const userTag = `@${sender.split('@')[0]}`;
    const userName = await getContactName(conn, sender);
    const warnLimit = getGroupSetting(from, 'warnLimit');

    if (actionType === 'warn') {
        const warn = (warningTracker.get(sender) || 0) + warnIncrement;
        warningTracker.set(sender, warn);
        
        let message = customMessage || `⚠️ @${sender.split('@')[0]} • *WARNING ${warn}/${warnLimit}*\n\nReason: ${reason}\nYour message has been deleted.`;
        
        await conn.sendMessage(from, { text: fancy(message), mentions: mention }).catch(() => {});
        
        if (warn >= warnLimit) {
            await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
            const removeMsg = `🚫 @${sender.split('@')[0]} • *REMOVED FROM GROUP*\n\nReason: ${reason}\nExceeded ${warnLimit} warnings.`;
            await conn.sendMessage(from, { text: fancy(removeMsg), mentions: mention }).catch(() => {});
            warningTracker.delete(sender);
        }
    }
    
    if (actionType === 'remove') {
        await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
        const removeMsg = `🚫 @${sender.split('@')[0]} • *REMOVED FROM GROUP*\n\nReason: ${reason}`;
        await conn.sendMessage(from, { text: fancy(removeMsg), mentions: mention }).catch(() => {});
    }
    
    if (actionType === 'block') {
        await conn.updateBlockStatus(sender, 'block').catch(() => {});
    }
}

// ==================== ANTI FEATURES ====================
async function handleAntiLink(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antilink')) return false;
    const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-\/a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    if (!linkRegex.test(body)) return false;
    
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    const customMsg = `⚠️ @${sender.split('@')[0]} • *ANTI-LINK*\n\nYou sent a link which is not allowed.\nYour message has been deleted.`;
    await applyAction(conn, from, sender, 'warn', 'Sending links', 1, customMsg);
    return true;
}

async function handleAntiPorn(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antiporn')) return false;
    const keywords = getGroupSetting(from, 'pornKeywords');
    if (keywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        const customMsg = `⚠️ @${sender.split('@')[0]} • *ADULT CONTENT DETECTED*\n\nAdult/explicit content is strictly forbidden.\nYour message has been deleted.`;
        await applyAction(conn, from, sender, 'warn', 'Adult content', 2, customMsg);
        return true;
    }
    return false;
}

async function handleAntiScam(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antiscam')) return false;
    const keywords = getGroupSetting(from, 'scamKeywords');
    if (keywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        
        const meta = await conn.groupMetadata(from);
        const allMentions = meta.participants.map(p => p.id);
        await conn.sendMessage(from, {
            text: fancy(`🚨 *SCAM ALERT!*\n\n@${sender.split('@')[0]} sent a message that appears to be a scam.\nThe message has been deleted. Do not engage.`),
            mentions: allMentions
        }).catch(() => {});
        
        const customMsg = `⚠️ @${sender.split('@')[0]} • *SCAM DETECTED*\n\nYou sent a message that appears to be a scam.\nThis puts members at risk.`;
        await applyAction(conn, from, sender, 'warn', 'Scam content', 2, customMsg);
        return true;
    }
    return false;
}

async function handleAntiMedia(conn, msg, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antimedia')) return false;
    const blocked = getGroupSetting(from, 'blockedMediaTypes') || [];
    
    const isPhoto = !!msg.message?.imageMessage;
    const isVideo = !!msg.message?.videoMessage;
    const isSticker = !!msg.message?.stickerMessage;
    const isAudio = !!msg.message?.audioMessage;
    const isDocument = !!msg.message?.documentMessage;
    
    let mediaType = '';
    if (isPhoto) mediaType = 'PHOTO';
    else if (isVideo) mediaType = 'VIDEO';
    else if (isSticker) mediaType = 'STICKER';
    else if (isAudio) mediaType = 'AUDIO';
    else if (isDocument) mediaType = 'DOCUMENT';
    
    if ((blocked.includes('photo') && isPhoto) ||
        (blocked.includes('video') && isVideo) ||
        (blocked.includes('sticker') && isSticker) ||
        (blocked.includes('audio') && isAudio) ||
        (blocked.includes('document') && isDocument) ||
        (blocked.includes('all') && (isPhoto || isVideo || isSticker || isAudio || isDocument))) {
        
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        const customMsg = `⚠️ @${sender.split('@')[0]} • *MEDIA NOT ALLOWED*\n\nYou sent a ${mediaType} which is not allowed.\nYour message has been deleted.`;
        await applyAction(conn, from, sender, 'warn', `Sending ${mediaType}`, 1, customMsg);
        return true;
    }
    return false;
}

async function handleAntiTag(conn, msg, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antitag')) return false;
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentions || mentions.length < getGroupSetting(from, 'maxTags')) return false;
    
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    const customMsg = `⚠️ @${sender.split('@')[0]} • *EXCESSIVE TAGGING*\n\nYou tagged ${mentions.length} people.\nExcessive tagging is not allowed.`;
    await applyAction(conn, from, sender, 'warn', 'Excessive tagging', 1, customMsg);
    return true;
}

async function handleViewOnce(conn, msg) {
    if (!getGroupSetting('global', 'antiviewonce')) return false;
    if (!msg.message?.viewOnceMessageV2 && !msg.message?.viewOnceMessage) return false;
    
    const caption = msg.message?.viewOnceMessageV2?.message?.imageMessage?.caption ||
                    msg.message?.viewOnceMessage?.message?.imageMessage?.caption || '';
    
    for (const num of config.ownerNumber) {
        await conn.sendMessage(num + '@s.whatsapp.net', {
            forward: msg,
            caption: fancy(`🔐 *VIEW-ONCE RECOVERED*\n\nFrom: @${msg.key.participant?.split('@')[0] || 'Unknown'}\nTime: ${new Date().toLocaleString()}\nCaption: ${caption || 'No caption'}`),
            contextInfo: { mentionedJid: [msg.key.participant] }
        }).catch(() => {});
    }
    return true;
}

async function handleAntiDelete(conn, msg) {
    if (!getGroupSetting('global', 'antidelete')) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 0) return false; // 0 = DELETE
    
    const deletedMsgId = msg.message.protocolMessage.key.id;
    const stored = messageStore.get(deletedMsgId);
    if (!stored) return false;
    
    for (const num of config.ownerNumber) {
        await conn.sendMessage(num + '@s.whatsapp.net', {
            text: fancy(`🗑️ *DELETED MESSAGE RECOVERED*\n\nFrom: @${stored.sender.split('@')[0]}\nMessage: ${stored.content}\nTime: ${stored.timestamp?.toLocaleString() || 'Unknown'}`),
            mentions: [stored.sender]
        }).catch(() => {});
    }
    
    messageStore.delete(deletedMsgId);
    return true;
}

async function handleAntiBugs(conn, msg, from, sender) {
    if (!getGroupSetting(from, 'antibugs')) return false;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
    if (body.length > 10000 || /[\uD800-\uDFFF]{10,}/.test(body) || /[\u200B-\u200D]{50,}/.test(body)) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await conn.updateBlockStatus(sender, 'block').catch(() => {});
        bugReports.push({ timestamp: new Date(), sender, message: body.slice(0, 100), action: 'blocked' });
        for (const num of config.ownerNumber) {
            await conn.sendMessage(num + '@s.whatsapp.net', {
                text: fancy(`⚠️ *BUG DETECTED*\n\nSender: ${sender}\nMessage: ${body.slice(0, 200)}...\n\nBlocked and reported.`)
            }).catch(() => {});
        }
        return true;
    }
    return false;
}

async function handleAntiSpam(conn, msg, from, sender) {
    if (!getGroupSetting(from, 'antispam')) return false;
    const now = Date.now();
    const key = `${from}:${sender}`;
    const limit = getGroupSetting(from, 'antiSpamLimit');
    const interval = getGroupSetting(from, 'antiSpamInterval');
    
    let record = spamTracker.get(key) || { count: 0, timestamp: now };
    if (now - record.timestamp > interval) {
        record = { count: 1, timestamp: now };
    } else {
        record.count++;
    }
    spamTracker.set(key, record);
    if (record.count > limit) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        const customMsg = `⚠️ @${sender.split('@')[0]} • *ANTI-SPAM*\n\nYou are sending messages too fast!\nPlease slow down.`;
        await applyAction(conn, from, sender, 'warn', 'Spamming', 1, customMsg);
        return true;
    }
    return false;
}

async function handleAntiCall(conn, call) {
    if (!globalSettings.anticall) return;
    await conn.rejectCall(call.id, call.from).catch(() => {});
    if (!config.ownerNumber.includes(call.from.split('@')[0])) {
        await conn.updateBlockStatus(call.from, 'block').catch(() => {});
    }
}

// ==================== AUTO STATUS ====================
async function handleAutoStatus(conn, statusMsg) {
    if (!globalSettings.autostatus) return;
    if (statusMsg.key.remoteJid !== 'status@broadcast') return;
    
    const actions = globalSettings.autoStatusActions;
    const statusId = statusMsg.key.id;
    
    if (statusCache.has(statusId)) return;
    statusCache.set(statusId, true);
    if (statusCache.size > 500) {
        const keys = Array.from(statusCache.keys()).slice(0, 100);
        keys.forEach(k => statusCache.delete(k));
    }
    
    if (actions.includes('view')) {
        await conn.readMessages([statusMsg.key]).catch(() => {});
    }
    
    if (actions.includes('react')) {
        const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
        await conn.sendMessage('status@broadcast', { react: { text: emoji, key: statusMsg.key } }).catch(() => {});
    }
    
    if (actions.includes('reply')) {
        const caption = statusMsg.message?.imageMessage?.caption || 
                        statusMsg.message?.videoMessage?.caption || 
                        statusMsg.message?.conversation || '';
        if (caption) {
            try {
                const aiResponse = await getAIResponse(caption, true);
                await conn.sendMessage(statusMsg.key.participant, { 
                    text: fancy(`📱 *Status Reply*\n\n${aiResponse}`) 
                }).catch(() => {});
            } catch {}
        }
    }
}

// ==================== AI CHATBOT ====================
async function getAIResponse(text, isStatusReply = false) {
    try {
        const systemPrompt = isStatusReply ? 
            `You are replying to someone's WhatsApp status. Be warm, friendly, and brief. Use emojis occasionally. Match their language.` :
            globalSettings.chatbotPrompt;
        
        const response = await axios.get(
            `${globalSettings.aiApiUrl}${encodeURIComponent(text)}?system=${encodeURIComponent(systemPrompt)}`,
            { timeout: 15000 }
        );
        
        let reply = response.data;
        reply = reply.replace(/^AI:|^Assistant:|^Bot:/i, '').trim();
        return reply || "I didn't quite get that. Could you rephrase?";
    } catch (error) {
        console.error("AI Error:", error);
        const fallbacks = [
            "Interesting! Tell me more.",
            "I understand. Go on...",
            "That's nice! 😊",
            "Really? That's cool!",
            "I see what you mean."
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}

async function handleChatbot(conn, msg, from, body, sender) {
    if (!getGroupSetting(from, 'chatbot') && !getGroupSetting('global', 'chatbot')) return false;
    
    const isGroup = from.endsWith('@g.us');
    if (isGroup) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.stanzaId &&
                             msg.message.extendedTextMessage.contextInfo.participant === botJid;
        if (!mentioned.includes(botJid) && !isReplyToBot) return false;
    }
    
    await conn.sendPresenceUpdate('composing', from);
    try {
        const aiResponse = await getAIResponse(body);
        await conn.sendMessage(from, {
            text: fancy(aiResponse),
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: globalSettings.newsletterJid,
                    newsletterName: globalSettings.botName
                }
            }
        }, { quoted: msg }).catch(() => {});
        return true;
    } catch {
        return false;
    }
}

// ==================== WELCOME / GOODBYE ====================
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    if (!getGroupSetting(groupJid, 'welcomeGoodbye')) return;
    try {
        const name = await getContactName(conn, participant);
        const group = await getGroupName(conn, groupJid);
        const meta = await conn.groupMetadata(groupJid);
        const total = meta.participants.length;
        
        let quote = '';
        try {
            const res = await axios.get(globalSettings.quoteApiUrl);
            quote = res.data.content;
        } catch { 
            quote = action === 'add' ? 'Welcome to the family!' : 'We will miss you!'; 
        }
        
        let caption = action === 'add'
            ? fancy(`╔════════════════════╗\n║   🎉 *WELCOME* 🎉   ║\n╚════════════════════╝\n\n👤 *Name:* ${name}\n📞 *Phone:* ${getUsername(participant)}\n🕐 *Joined:* ${new Date().toLocaleString()}\n👥 *Members:* ${total}\n\n💬 *Quote:* "${quote}"`)
            : fancy(`╔════════════════════╗\n║   👋 *GOODBYE* 👋   ║\n╚════════════════════╝\n\n👤 *Name:* ${name}\n📞 *Phone:* ${getUsername(participant)}\n🕐 *Left:* ${new Date().toLocaleString()}\n👥 *Members:* ${total}\n\n💬 *Quote:* "${quote}"`);
        
        await conn.sendMessage(groupJid, { text: caption, mentions: [participant] }).catch(() => {});
    } catch (e) {
        console.error("Welcome/Goodbye error:", e);
    }
}

// ==================== AUTO REMOVE INACTIVE ====================
async function autoRemoveInactive(conn) {
    if (!globalSettings.activemembers) return;
    const inactiveDays = globalSettings.inactiveDays;
    const now = Date.now();
    
    for (const [jid, _] of groupSettings) {
        if (!jid.endsWith('@g.us')) continue;
        if (!getGroupSetting(jid, 'activemembers')) continue;
        const isAdmin = await isBotAdmin(conn, jid);
        if (!isAdmin) continue;
        const meta = await conn.groupMetadata(jid).catch(() => null);
        if (!meta) continue;
        const toRemove = [];
        for (const p of meta.participants) {
            const lastActive = inactiveTracker.get(p.id) || 0;
            if (now - lastActive > inactiveDays * 24 * 60 * 60 * 1000) {
                toRemove.push(p.id);
            }
        }
        if (toRemove.length) {
            await conn.groupParticipantsUpdate(jid, toRemove, 'remove').catch(() => {});
            await conn.sendMessage(jid, { 
                text: fancy(`🧹 *Inactive Members Removed*\n\nRemoved ${toRemove.length} inactive members (${inactiveDays} days without activity).`) 
            }).catch(() => {});
        }
    }
}

// ==================== AUTO BIO ====================
async function updateAutoBio(conn) {
    if (!globalSettings.autoBio) return;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const bio = `${globalSettings.developer} • Uptime: ${hours}h ${minutes}m • INSIDIOUS V2`;
    await conn.updateProfileStatus(bio).catch(() => {});
}

// ==================== SLEEPING MODE ====================
let sleepingCron = null;
async function initSleepingMode(conn) {
    if (sleepingCron) sleepingCron.stop();
    if (!globalSettings.sleepingmode) return;
    
    const [startHour, startMin] = globalSettings.sleepingStart.split(':').map(Number);
    const [endHour, endMin] = globalSettings.sleepingEnd.split(':').map(Number);
    
    sleepingCron = cron.schedule('* * * * *', async () => {
        const now = new Date();
        const current = now.getHours() * 60 + now.getMinutes();
        const start = startHour * 60 + startMin;
        const end = endHour * 60 + endMin;
        
        for (const [jid, _] of groupSettings) {
            if (!jid.endsWith('@g.us')) continue;
            if (!getGroupSetting(jid, 'sleepingmode')) continue;
            const isAdmin = await isBotAdmin(conn, jid);
            if (!isAdmin) continue;
            const meta = await conn.groupMetadata(jid).catch(() => null);
            if (!meta) continue;
            const isClosed = meta.announce === true;
            
            if (start <= end) {
                if (current >= start && current < end) {
                    if (!isClosed) await conn.groupSettingUpdate(jid, 'announcement').catch(() => {});
                } else {
                    if (isClosed) await conn.groupSettingUpdate(jid, 'not_announcement').catch(() => {});
                }
            } else {
                if (current >= start || current < end) {
                    if (!isClosed) await conn.groupSettingUpdate(jid, 'announcement').catch(() => {});
                } else {
                    if (isClosed) await conn.groupSettingUpdate(jid, 'not_announcement').catch(() => {});
                }
            }
        }
    });
}

// ==================== AUTO BLOCK COUNTRY ====================
async function handleAutoBlockCountry(conn, participant, isExempt = false) {
    if (!globalSettings.autoblockCountry || isExempt) return false;
    const blocked = globalSettings.blockedCountries || [];
    if (!blocked.length) return false;
    const number = participant.split('@')[0];
    const countryMatch = number.match(/^(\d{1,3})/);
    if (countryMatch) {
        const code = countryMatch[1];
        if (blocked.includes(code)) {
            await conn.updateBlockStatus(participant, 'block').catch(() => {});
            return true;
        }
    }
    return false;
}

// ==================== COMMAND HANDLER ====================
async function handleCommand(conn, msg, body, from, sender, isOwner, isDeployerUser, isCoOwnerUser) {
    let prefix = globalSettings.prefix;
    if (!body.startsWith(prefix)) return false;
    
    const args = body.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    let isGroupAdmin = false;
    if (from.endsWith('@g.us')) {
        isGroupAdmin = await isParticipantAdmin(conn, from, sender);
    }
    const isPrivileged = isOwner || isGroupAdmin;

    // Required group check
    if (!isPrivileged && globalSettings.requiredGroupJid) {
        const inGroup = await isUserInRequiredGroup(conn, sender);
        if (!inGroup) {
            await msg.reply(fancy(`❌ You must join our group to use this bot.\nJoin here: ${globalSettings.requiredGroupInvite}`));
            return true;
        }
    }

    // Mode check
    if (globalSettings.mode === 'self' && !isOwner) {
        await msg.reply(fancy('❌ Bot is in private mode. Only owner can use commands.'));
        return true;
    }

    const cmdPath = path.join(__dirname, 'commands');
    if (await fs.pathExists(cmdPath)) {
        const categories = await fs.readdir(cmdPath);
        let found = false;
        for (const cat of categories) {
            const catPath = path.join(cmdPath, cat);
            if (!(await fs.stat(catPath)).isDirectory()) continue;
            const filePath = path.join(catPath, `${cmd}.js`);
            if (await fs.pathExists(filePath)) {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (command.ownerOnly && !isOwner) {
                    await msg.reply(fancy('❌ This command is for owner only!'));
                    return true;
                }
                if (command.adminOnly && !isPrivileged) {
                    await msg.reply(fancy('❌ This command is for group admins only!'));
                    return true;
                }
                
                try {
                    await command.execute(conn, msg, args, {
                        from,
                        sender,
                        fancy,
                        config: globalSettings,
                        isOwner,
                        isDeployer: isDeployerUser,
                        isCoOwner: isCoOwnerUser,
                        reply: msg.reply,
                        botId: botSecretId,
                        canPairNumber,
                        pairNumber,
                        unpairNumber,
                        getPairedNumbers: () => Array.from(pairedNumbers),
                        isBotAdmin: (jid) => isBotAdmin(conn, jid),
                        isParticipantAdmin: (jid, participant) => isParticipantAdmin(conn, jid, participant),
                        getGroupSetting: (key) => getGroupSetting(from, key)
                    });
                } catch (e) {
                    console.error(`Command error (${cmd}):`, e);
                    await msg.reply(fancy(`❌ Command error: ${e.message}`));
                }
                found = true;
                break;
            }
        }
        if (!found) await msg.reply(fancy(`❌ Command "${cmd}" not found`));
    } else {
        await msg.reply(fancy('❌ Commands folder not found.'));
    }
    return true;
}

// ==================== MAIN HANDLER ====================
module.exports = async (conn, m) => {
    try {
        if (!m.messages?.[0]) return;
        let msg = m.messages[0];
        if (!msg.message) return;

        // Handle status broadcasts
        if (msg.key.remoteJid === 'status@broadcast') {
            await handleAutoStatus(conn, msg);
            return;
        }

        await loadGlobalSettings();
        await loadGroupSettings();

        msg = enhanceMessage(conn, msg);

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];

        // ========== BUTTON CLICK HANDLING ==========
        const type = Object.keys(msg.message)[0];
        let body = "";

        if (type === 'interactiveResponseMessage') {
            try {
                const nativeFlow = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage;
                if (nativeFlow && nativeFlow.paramsJson) {
                    const parsed = JSON.parse(nativeFlow.paramsJson);
                    body = parsed.id || "";
                    console.log('🔘 Button clicked:', body);
                }
            } catch (e) {
                console.error("Button parse error:", e);
                body = "";
            }
        } else if (type === 'conversation') {
            body = msg.message.conversation || "";
        } else if (type === 'extendedTextMessage') {
            body = msg.message.extendedTextMessage.text || "";
        } else if (type === 'imageMessage') {
            body = msg.message.imageMessage.caption || "";
        } else if (type === 'videoMessage') {
            body = msg.message.videoMessage.caption || "";
        } else {
            body = "";
        }

        body = body.trim();

        const isFromMe = msg.key.fromMe || false;
        const isDeployerUser = isDeployer(senderNumber);
        const isCoOwnerUser = isCoOwner(senderNumber);
        const isOwner = isFromMe || isDeployerUser || isCoOwnerUser;

        const isGroup = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');

        let isGroupAdmin = false;
        if (isGroup) {
            isGroupAdmin = await isParticipantAdmin(conn, from, sender);
        }
        const isExempt = isOwner || isGroupAdmin;

        // Store message for anti-delete
        if (body && !type.includes('interactive')) {
            messageStore.set(msg.key.id, { content: body, sender, timestamp: new Date() });
            if (messageStore.size > 1000) {
                const keys = Array.from(messageStore.keys()).slice(0, 200);
                keys.forEach(k => messageStore.delete(k));
            }
        }

        // Auto presence
        if (globalSettings.autoTyping) await conn.sendPresenceUpdate('composing', from).catch(() => {});
        if (globalSettings.autoRecording && !isGroup) await conn.sendPresenceUpdate('recording', from).catch(() => {});
        if (globalSettings.autoRead && !type.includes('interactive')) await conn.readMessages([msg.key]).catch(() => {});
        if (globalSettings.autoReact && !msg.key.fromMe && !isChannel && !type.includes('interactive')) {
            const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
            await conn.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
        }

        // Security features (skip if exempt)
        if (!isExempt && !type.includes('interactive')) {
            if (await handleAntiBugs(conn, msg, from, sender)) return;
            if (await handleAntiSpam(conn, msg, from, sender)) return;
        }

        // View once & anti delete (always)
        await handleViewOnce(conn, msg);
        await handleAntiDelete(conn, msg);

        // Commands (including button commands)
        if (body) {
            const handled = await handleCommand(conn, msg, body, from, sender, isOwner, isDeployerUser, isCoOwnerUser);
            if (handled) return;
        }

        // Group security (non-exempt)
        if (isGroup && !isExempt && !type.includes('interactive')) {
            if (await handleAntiLink(conn, msg, body, from, sender)) return;
            if (await handleAntiScam(conn, msg, body, from, sender)) return;
            if (await handleAntiPorn(conn, msg, body, from, sender)) return;
            if (await handleAntiMedia(conn, msg, from, sender)) return;
            if (await handleAntiTag(conn, msg, from, sender)) return;
        }

        // Chatbot (non-owners)
        if (body && !body.startsWith(globalSettings.prefix) && !isOwner && globalSettings.chatbot && !type.includes('interactive')) {
            await handleChatbot(conn, msg, from, body, sender);
        }

        // Track activity
        if (!type.includes('interactive')) {
            inactiveTracker.set(sender, Date.now());
        }

    } catch (err) {
        console.error('❌ Handler Error:', err);
    }
};

// ==================== GROUP UPDATE HANDLER ====================
module.exports.handleGroupUpdate = async (conn, update) => {
    await loadGlobalSettings();
    await loadGroupSettings();
    const { id, participants, action } = update;
    if (action === 'add') {
        for (const p of participants) {
            const pNumber = p.split('@')[0];
            const pIsOwner = isDeployer(pNumber) || isCoOwner(pNumber);
            await handleAutoBlockCountry(conn, p, pIsOwner);
            if (getGroupSetting(id, 'welcomeGoodbye')) {
                await handleWelcome(conn, p, id, 'add');
            }
        }
    } else if (action === 'remove') {
        for (const p of participants) {
            if (getGroupSetting(id, 'welcomeGoodbye')) {
                await handleWelcome(conn, p, id, 'remove');
            }
        }
    }
};

// ==================== CALL HANDLER ====================
module.exports.handleCall = async (conn, call) => {
    await loadGlobalSettings();
    await handleAntiCall(conn, call);
};

// ==================== INITIALIZATION ====================
module.exports.init = async (conn) => {
    console.log(fancy('[SYSTEM] Initializing INSIDIOUS: THE LAST KEY...'));
    await loadGlobalSettings();
    await loadPairedNumbers();
    await loadGroupSettings();
    initSleepingMode(conn);

    if (globalSettings.autoBio) {
        setInterval(() => updateAutoBio(conn), 60000);
    }
    if (globalSettings.activemembers) {
        setInterval(() => autoRemoveInactive(conn), 24 * 60 * 60 * 1000);
    }

    console.log(fancy(`🔐 Bot ID: ${botSecretId}`));
    console.log(fancy(`🌐 Mode: ${globalSettings.mode.toUpperCase()}`));
    console.log(fancy(`📋 Co‑owners: ${Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n)).length}/${globalSettings.maxCoOwners}`));
    
    for (const ch of globalSettings.autoFollowChannels) {
        try { await conn.groupAcceptInvite(ch.split('@')[0]); } catch {}
    }

    // Send welcome to owner(s)
    const allOwners = config.ownerNumber.map(num => num + '@s.whatsapp.net');
    for (const ownerJid of allOwners) {
        try {
            await conn.sendMessage(ownerJid, {
                image: { url: globalSettings.aliveImage },
                caption: fancy(`╔════════════════════╗\n║   ✅ *BOT ONLINE*   ║\n╚════════════════════╝\n\n🤖 *Name:* ${globalSettings.botName}\n📞 *Number:* ${conn.user.id.split(':')[0]}\n🔐 *ID:* ${botSecretId}\n🌐 *Mode:* ${globalSettings.mode.toUpperCase()}\n⚡ *Status:* ONLINE\n\n👑 *Developer:* ${globalSettings.developer}\n💾 *Version:* ${globalSettings.version}`),
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: globalSettings.newsletterJid,
                        newsletterName: globalSettings.botName
                    }
                }
            });
        } catch {}
    }

    console.log(fancy('[SYSTEM] ✅ All systems ready'));
};

// ==================== EXPORTS ====================
module.exports.pairNumber = pairNumber;
module.exports.unpairNumber = unpairNumber;
module.exports.getPairedNumbers = () => Array.from(pairedNumbers);
module.exports.getBotId = () => botSecretId;
module.exports.isDeployer = isDeployer;
module.exports.isCoOwner = isCoOwner;
module.exports.canPairNumber = canPairNumber;
module.exports.loadGlobalSettings = loadGlobalSettings;
module.exports.saveGlobalSettings = saveGlobalSettings;
module.exports.getGroupSetting = getGroupSetting;
module.exports.setGroupSetting = setGroupSetting;
module.exports.loadSettings = loadGlobalSettings;
module.exports.saveSettings = saveGlobalSettings;
module.exports.refreshConfig = refreshConfig;