const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');

// ==================== LOAD CONFIG ====================
let config = {};
try { config = require('./config'); } catch { config = {}; }

config.ownerNumber = (config.ownerNumber || [])
    .map(num => num.replace(/[^0-9]/g, ''))
    .filter(num => num.length >= 10);

// ==================== MONGODB SCHEMAS ====================
const SettingsSchema = new mongoose.Schema({
    type: { type: String, default: 'global' },
    data: { type: Object, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

const PairedSchema = new mongoose.Schema({
    botId: { type: String, required: true },
    paired: [{ type: String }],
    updatedAt: { type: Date, default: Date.now }
});

const SettingsModel = mongoose.model('Settings', SettingsSchema);
const PairedModel = mongoose.model('Paired', PairedSchema);

// ==================== DEFAULT SETTINGS ====================
const DEFAULT_SETTINGS = {
    mode: 'public',
    prefix: '.',
    maxCoOwners: 2,
    botName: 'INSIDIOUS: THE LAST KEY',
    developer: 'Stanley Assanaly',
    version: '2.1.1',
    year: 2025,
    updated: 2026,
    specialThanks: 'REDTECH',
    botImage: 'https://files.catbox.moe/mfngio.png',
    aliveImage: 'https://files.catbox.moe/mfngio.png',
    newsletterJid: '120363404317544295@newsletter',
    requiredGroupJid: '120363406549688641@g.us',
    requiredGroupInvite: 'https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y',
    autoFollowChannels: ['120363404317544295@newsletter'],

    // ========== ANTI FEATURES ==========
    antilink: true,
    antiporn: true,
    antiscam: true,
    antimedia: true,
    antitag: true,
    antiviewonce: true,
    antidelete: true,
    sleepingmode: true,
    antispam: true,
    anticall: true,
    antibugs: true,           // NEW
    antibot: true,            // NEW
    antimentionspam: true,    // NEW - Anti mention status

    // ========== AUTO FEATURES ==========
    autoRead: true,
    autoReact: true,
    autoTyping: true,
    autoRecording: true,
    autoBio: true,
    autostatus: true,
    downloadStatus: false,
    autoSaveContact: false,
    autoDeleteMessages: false,

    // ========== GROUP MANAGEMENT ==========
    welcomeGoodbye: true,
    activemembers: true,
    autoblockCountry: false,

    // ========== AI ==========
    chatbot: true,

    // ========== THRESHOLDS & LIMITS ==========
    warnLimit: 3,
    maxTags: 5,
    inactiveDays: 7,
    antiSpamLimit: 5,
    antiSpamInterval: 10000,
    sleepingStart: '23:00',
    sleepingEnd: '06:00',
    maxCoOwners: 2,
    statusReplyLimit: 50,
    antibugsLimit: 3,         // NEW
    antibotAction: 'remove',  // NEW - remove/kick/block
    maxMentions: 10,          // NEW - for anti-mention

    // ========== KEYWORDS ==========
    scamKeywords: ['win', 'prize', 'lottery', 'congratulations', 'million', 'inheritance', 'selected'],
    pornKeywords: ['xxx', 'porn', 'sex', 'nude', 'adult', '18+', 'onlyfans'],
    blockedMediaTypes: ['photo', 'video', 'sticker'],
    blockedCountries: [],
    botKeywords: ['bot', 'robot', 'automation', 'script', 'baileys', 'whiskeysockets'], // NEW

    // ========== AUTO REACT / STATUS ==========
    autoReactEmojis: ['❤️', '🔥', '👍', '🎉', '👏', '⚡', '✨', '🌟'],
    autoStatusActions: ['view', 'react', 'reply'],
    statusReplyLimit: 50,

    // ========== SCOPES ==========
    autoReadScope: 'all',
    autoReactScope: 'all',
    chatbotScope: 'all',
    antiviewonceScope: 'all',
    antideleteScope: 'all',

    // ========== AUTO EXPIRE ==========
    autoExpireMinutes: 10,

    // ========== API ==========
    quoteApiUrl: 'https://api.quotable.io/random',
    aiApiUrl: 'https://text.pollinations.ai/',
    pornFilterApiKey: '',
};

// ==================== GLOBAL VARIABLES ====================
let globalSettings = { ...DEFAULT_SETTINGS };
let groupSettings = new Map();
let pairedNumbers = new Set();
let botSecretId = null;

// ==================== DATABASE FUNCTIONS ====================
async function loadGlobalSettings() {
    try {
        const doc = await SettingsModel.findOne({ type: 'global' });
        if (doc && doc.data) {
            globalSettings = { ...DEFAULT_SETTINGS, ...doc.data };
        } else {
            await SettingsModel.create({ type: 'global', data: DEFAULT_SETTINGS });
            globalSettings = { ...DEFAULT_SETTINGS };
        }
    } catch (e) {
        console.error('Load settings error:', e);
        globalSettings = { ...DEFAULT_SETTINGS };
    }
    return globalSettings;
}

async function saveGlobalSettings(settings = globalSettings) {
    try {
        await SettingsModel.findOneAndUpdate(
            { type: 'global' },
            { type: 'global', data: settings, updatedAt: new Date() },
            { upsert: true }
        );
        globalSettings = settings;
    } catch (e) {
        console.error('Save settings error:', e);
    }
}

async function loadPairedNumbers() {
    try {
        const doc = await PairedModel.findOne({});
        if (doc) {
            pairedNumbers = new Set(doc.paired || []);
            botSecretId = doc.botId;
        } else {
            botSecretId = generateBotId();
            await PairedModel.create({ botId: botSecretId, paired: [] });
        }
    } catch (e) {
        console.error('Load paired error:', e);
        pairedNumbers = new Set();
        botSecretId = generateBotId();
    }
    config.ownerNumber.forEach(num => num && pairedNumbers.add(num));
}

async function savePairedNumbers() {
    try {
        const nonOwnerPaired = Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n));
        await PairedModel.findOneAndUpdate(
            {},
            { botId: botSecretId, paired: nonOwnerPaired, updatedAt: new Date() },
            { upsert: true }
        );
    } catch (e) {
        console.error('Save paired error:', e);
    }
}

function generateBotId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'INS';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

// ==================== PAIRING FUNCTIONS ====================
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

function isOwner(number) {
    return isDeployer(number) || isCoOwner(number);
}

// ==================== MEMORY STORAGE (TEMPORARY) ====================
const messageStore = new Map();
const warningTracker = new Map();
const spamTracker = new Map();
const inactiveTracker = new Map();
const statusCache = new Map();
const aiRateLimiter = new Map();
const bugsTracker = new Map();        // NEW - Track bugs attempts
const botTracker = new Map();         // NEW - Track bot detection
const mentionTracker = new Map();     // NEW - Track mentions

let statusReplyCount = 0;
let lastReset = Date.now();

// ==================== MEMORY MANAGEMENT ====================
const MAX_STORE_SIZE = 2000;
const CLEANUP_INTERVAL = 10 * 60 * 1000;

setInterval(() => {
    if (messageStore.size > MAX_STORE_SIZE) {
        const keys = Array.from(messageStore.keys()).slice(0, messageStore.size - MAX_STORE_SIZE + 500);
        keys.forEach(k => messageStore.delete(k));
    }
    
    const now = Date.now();
    for (const [key, data] of spamTracker) {
        if (now - data.timestamp > 60 * 60 * 1000) spamTracker.delete(key);
    }
    for (const [key, data] of aiRateLimiter) {
        if (now > data.resetTime) aiRateLimiter.delete(key);
    }
    for (const [key, data] of bugsTracker) {
        if (now - data.timestamp > 30 * 60 * 1000) bugsTracker.delete(key);
    }
    for (const [key, data] of mentionTracker) {
        if (now - data.timestamp > 5 * 60 * 1000) mentionTracker.delete(key);
    }
    
    if (now - lastReset > 24 * 60 * 60 * 1000) {
        statusReplyCount = 0;
        lastReset = now;
    }
}, CLEANUP_INTERVAL);

// ==================== HELPER FUNCTIONS ====================
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

function getUsername(jid) { return jid?.split('@')[0] || 'Unknown'; }

async function getContactName(conn, jid) {
    try {
        if (conn.contacts?.[jid]?.name) return conn.contacts[jid].name;
        if (conn.contacts?.[jid]?.pushname) return conn.contacts[jid].pushname;
        return getUsername(jid);
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
        const botId = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const meta = await conn.groupMetadata(groupJid);
        return meta.participants.some(p => p.id === botId && (p.admin === 'admin' || p.admin === 'superadmin'));
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

// ==================== MESSAGE EXTRACTOR ====================
function extractMessageText(msg) {
    try {
        if (!msg?.message) return '';
        const type = Object.keys(msg.message)[0];
        let body = '';

        if (type === 'conversation') body = msg.message.conversation || '';
        else if (type === 'extendedTextMessage') body = msg.message.extendedTextMessage.text || '';
        else if (type === 'buttonsResponseMessage') body = msg.message.buttonsResponseMessage.selectedButtonId || '';
        else if (type === 'templateButtonReplyMessage') body = msg.message.templateButtonReplyMessage.selectedId || '';
        else if (type === 'interactiveResponseMessage') {
            try {
                const nativeFlow = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage;
                if (nativeFlow?.paramsJson) {
                    const parsed = JSON.parse(nativeFlow.paramsJson);
                    body = parsed.id || '';
                }
            } catch {}
        }
        else if (type === 'imageMessage') body = msg.message.imageMessage.caption || '';
        else if (type === 'videoMessage') body = msg.message.videoMessage.caption || '';
        else if (type === 'documentMessage') body = msg.message.documentMessage.caption || '';
        else if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
            const subMsg = msg.message[type]?.message;
            if (subMsg) return extractMessageText({ message: subMsg });
        }
        return body.trim();
    } catch (e) {
        console.error('Extract message error:', e);
        return '';
    }
}

// ==================== ACTION APPLIER ====================
async function applyAction(conn, from, sender, actionType, reason, warnIncrement = 1, customMessage = '') {
    if (!from.endsWith('@g.us')) return;
    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) return;

    const mention = [sender];
    const userTag = `@${sender.split('@')[0]}`;
    const userName = await getContactName(conn, sender);

    if (actionType === 'warn') {
        const warn = (warningTracker.get(sender) || 0) + warnIncrement;
        warningTracker.set(sender, warn);
        const warnLimit = globalSettings.warnLimit;
        
        let message = customMessage || `⚠️ ${userTag} (${userName}) – You violated rule: *${reason}*. Warning ${warn}/${warnLimit}.`;
        await conn.sendMessage(from, { text: fancy(message), mentions: mention }).catch(() => {});
        
        if (warn >= warnLimit) {
            await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
            warningTracker.delete(sender);
        }
    } else if (actionType === 'remove') {
        await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
    } else if (actionType === 'block') {
        await conn.updateBlockStatus(sender, 'block').catch(() => {});
    }
}

// ==================== ANTI FEATURES ====================
async function handleAntiLink(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !globalSettings.antilink) return false;
    const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-\/a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    if (!linkRegex.test(body)) return false;
    
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    await applyAction(conn, from, sender, 'warn', 'Sending links', 1);
    return true;
}

async function handleAntiPorn(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !globalSettings.antiporn) return false;
    if (globalSettings.pornKeywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Adult content', 2);
        return true;
    }
    return false;
}

async function handleAntiScam(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !globalSettings.antiscam) return false;
    if (globalSettings.scamKeywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Scam content', 2);
        return true;
    }
    return false;
}

async function handleAntiMedia(conn, msg, from, sender) {
    if (!from.endsWith('@g.us') || !globalSettings.antimedia) return false;
    const blocked = globalSettings.blockedMediaTypes || [];
    const isPhoto = !!msg.message?.imageMessage;
    const isVideo = !!msg.message?.videoMessage;
    const isSticker = !!msg.message?.stickerMessage;
    
    if ((blocked.includes('photo') && isPhoto) ||
        (blocked.includes('video') && isVideo) ||
        (blocked.includes('sticker') && isSticker)) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Blocked media', 1);
        return true;
    }
    return false;
}

async function handleAntiTag(conn, msg, from, sender) {
    if (!from.endsWith('@g.us') || !globalSettings.antitag) return false;
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentions || mentions.length < globalSettings.maxTags) return false;
    
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    await applyAction(conn, from, sender, 'warn', 'Excessive tagging', 1);
    return true;
}

async function handleAntiSpam(conn, msg, from, sender) {
    if (!globalSettings.antispam) return false;
    const now = Date.now();
    const key = `${from}:${sender}`;
    let record = spamTracker.get(key) || { count: 0, timestamp: now };
    
    if (now - record.timestamp > globalSettings.antiSpamInterval) {
        record = { count: 1, timestamp: now };
    } else {
        record.count++;
    }
    spamTracker.set(key, record);
    
    if (record.count > globalSettings.antiSpamLimit) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Spamming', 1);
        return true;
    }
    return false;
}

// ==================== NEW: ANTI-BUGS ====================
async function handleAntiBugs(conn, msg, body, from, sender) {
    if (!globalSettings.antibugs) return false;
    
    // Detect bug patterns (crash codes, long strings, special chars)
    const bugPatterns = [
        /[\u200B-\u200F\uFEFF]/g,  // Zero-width chars
        /(.)\1{50,}/g,             // Repeated chars (50+ times)
        /[\u0000-\u001F]/g,        // Control characters
        /<script>/i,               // Script tags
        /eval\(/i,                 // Eval attempts
        /process\.exit/i,          // Process kill
        /while\s*\(\s*true\s*\)/i  // Infinite loops
    ];
    
    let bugScore = 0;
    for (const pattern of bugPatterns) {
        if (pattern.test(body)) bugScore++;
    }
    
    if (bugScore >= 2) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        const now = Date.now();
        const key = `${from}:${sender}`;
        const record = bugsTracker.get(key) || { count: 0, timestamp: now };
        record.count++;
        record.timestamp = now;
        bugsTracker.set(key, record);
        
        if (record.count >= globalSettings.antibugsLimit) {
            await applyAction(conn, from, sender, 'remove', 'Sending bugs/exploits', 3);
            bugsTracker.delete(key);
        } else {
            await applyAction(conn, from, sender, 'warn', 'Suspicious code/bugs', 2);
        }
        return true;
    }
    return false;
}

// ==================== NEW: ANTI-BOT ====================
async function handleAntiBot(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !globalSettings.antibot) return false;
    
    // Check if message contains bot indicators
    const botIndicators = [
        /bot\s*command/i,
        /\/start/i,
        /\/help/i,
        /\/menu/i,
        /^[!/#\.]/.test(body) && body.length < 10,  // Short commands
        /baileys|whiskeysockets|adiwajshing/i,
        /session|auth.*json/i
    ];
    
    let botScore = 0;
    for (const indicator of botIndicators) {
        if (typeof indicator === 'function') {
            if (indicator(body)) botScore++;
        } else if (indicator.test(body)) {
            botScore++;
        }
    }
    
    // Check sender behavior
    const now = Date.now();
    const key = `${from}:${sender}`;
    const record = botTracker.get(key) || { msgCount: 0, commandCount: 0, timestamp: now };
    
    if (body.startsWith(globalSettings.prefix) || /^[!/#\.]/.test(body)) {
        record.commandCount++;
    }
    record.msgCount++;
    record.timestamp = now;
    botTracker.set(key, record);
    
    // If high command ratio or bot keywords detected
    const commandRatio = record.msgCount > 5 ? record.commandCount / record.msgCount : 0;
    
    if (botScore >= 2 || (commandRatio > 0.8 && record.msgCount > 10)) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        
        const action = globalSettings.antibotAction || 'remove';
        if (action === 'remove') {
            await applyAction(conn, from, sender, 'remove', 'Detected as bot/automation');
        } else if (action === 'block') {
            await applyAction(conn, from, sender, 'block', 'Detected as bot/automation');
        }
        botTracker.delete(key);
        return true;
    }
    return false;
}

// ==================== NEW: ANTI-MENTION SPAM (STATUS) ====================
async function handleAntiMentionSpam(conn, msg, from, sender) {
    if (!from.endsWith('@g.us') || !globalSettings.antimentionspam) return false;
    
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length === 0) return false;
    
    const now = Date.now();
    const key = `${from}:${sender}`;
    let record = mentionTracker.get(key) || { count: 0, mentions: [], timestamp: now };
    
    // Add new mentions
    record.mentions.push(...mentions);
    record.count += mentions.length;
    record.timestamp = now;
    
    // Keep only last 5 minutes of mentions
    record.mentions = record.mentions.slice(-globalSettings.maxMentions);
    
    mentionTracker.set(key, record);
    
    // Check if mentioning too many unique people
    const uniqueMentions = [...new Set(record.mentions)];
    if (record.count > globalSettings.maxMentions || uniqueMentions.length > 5) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Mention spamming', 1);
        mentionTracker.delete(key);
        return true;
    }
    return false;
}

async function handleAntiCall(conn, call) {
    if (!globalSettings.anticall) return;
    try {
        await conn.rejectCall(call.id, call.from);
        if (!isOwner(call.from.split('@')[0])) {
            await conn.updateBlockStatus(call.from, 'block');
        }
    } catch (e) {
        console.error('AntiCall error:', e);
    }
}

async function handleViewOnce(conn, msg) {
    if (!globalSettings.antiviewonce) return false;
    if (!msg.message?.viewOnceMessageV2 && !msg.message?.viewOnceMessage) return false;
    
    for (const num of config.ownerNumber) {
        try {
            await conn.sendMessage(num + '@s.whatsapp.net', {
                forward: msg,
                caption: fancy('INSIDIOUS VIEW ONCE RECOVERY'),
                contextInfo: { mentionedJid: [msg.key.participant] }
            });
        } catch (e) {
            console.error('ViewOnce error:', e);
        }
    }
    return true;
}

async function handleAntiDelete(conn, msg) {
    if (!globalSettings.antidelete) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) return false;
    
    const stored = messageStore.get(msg.message.protocolMessage.key.id);
    if (!stored) return false;
    
    for (const num of config.ownerNumber) {
        try {
            await conn.sendMessage(num + '@s.whatsapp.net', {
                text: `🗑️ *DELETED MESSAGE*\n\nFrom: @${stored.sender.split('@')[0]}\nMessage: ${stored.content}`,
                mentions: [stored.sender]
            });
        } catch (e) {
            console.error('AntiDelete error:', e);
        }
    }
    messageStore.delete(msg.message.protocolMessage.key.id);
    return true;
}

// ==================== AUTO FEATURES ====================
async function handleAutoStatus(conn, statusMsg) {
    if (!globalSettings.autostatus) return;
    if (statusMsg.key.remoteJid !== 'status@broadcast') return;
    
    const statusId = statusMsg.key.id;
    if (statusCache.has(statusId)) return;
    statusCache.set(statusId, true);
    
    if (statusCache.size > 500) {
        const keys = Array.from(statusCache.keys()).slice(0, 100);
        keys.forEach(k => statusCache.delete(k));
    }
    
    const actions = globalSettings.autoStatusActions;
    if (actions.includes('view')) {
        await conn.readMessages([statusMsg.key]).catch(() => {});
    }
    if (actions.includes('react')) {
        const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
        await conn.sendMessage('status@broadcast', { react: { text: emoji, key: statusMsg.key } }).catch(() => {});
    }
}

async function updateAutoBio(conn) {
    if (!globalSettings.autoBio) return;
    try {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const bio = `${globalSettings.developer} | Uptime: ${hours}h ${minutes}m | INSIDIOUS V2`;
        await conn.updateProfileStatus(bio);
    } catch (e) {
        console.error('AutoBio error:', e);
    }
}

// ==================== WELCOME / GOODBYE ====================
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    if (!globalSettings.welcomeGoodbye) return;
    const isAdmin = await isBotAdmin(conn, groupJid);
    if (!isAdmin) return;

    const name = await getContactName(conn, participant);
    const group = await getGroupName(conn, groupJid);
    const meta = await conn.groupMetadata(groupJid).catch(() => null);
    if (!meta) return;
    
    const userTag = `@${participant.split('@')[0]}`;
    const header = action === 'add' ? `🎉 WELCOME TO ${group.toUpperCase()}!` : `👋 GOODBYE!`;
    const body = `👤 Name: ${name}\n📞 Phone: ${userTag}\n👥 Total Members: ${meta.participants.length}`;

    const message = fancy(`╭━━━━━━━━━━━━━━╮\n   ${header}\n╰━━━━━━━━━━━━━━╯\n\n${body}`);

    try {
        const picUrl = await conn.profilePictureUrl(participant, 'image').catch(() => null);
        if (picUrl) {
            await conn.sendMessage(groupJid, { image: { url: picUrl }, caption: message, mentions: [participant] });
        } else {
            await conn.sendMessage(groupJid, { text: message, mentions: [participant] });
        }
    } catch (e) {
        await conn.sendMessage(groupJid, { text: message, mentions: [participant] }).catch(() => {});
    }
}

function trackActivity(userJid) {
    inactiveTracker.set(userJid, Date.now());
}

// ==================== AI CHATBOT ====================
async function handleChatbot(conn, msg, from, body, sender) {
    if (!globalSettings.chatbot) return false;
    
    const isGroup = from.endsWith('@g.us');
    const scope = globalSettings.chatbotScope || 'all';
    if (scope === 'group' && !isGroup) return false;
    if (scope === 'private' && isGroup) return false;

    if (isGroup) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === botJid;
        if (!mentioned.includes(botJid) && !isReplyToBot) return false;
    }

    // Rate limiting
    const now = Date.now();
    const rateKey = `${from}:${sender}`;
    const userLimit = aiRateLimiter.get(rateKey) || { count: 0, resetTime: now + 60000 };
    
    if (now > userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = now + 60000;
    }
    
    if (userLimit.count >= 5) {
        await msg.reply(fancy('⏳ Please wait before sending more messages.'));
        return true;
    }
    
    userLimit.count++;
    aiRateLimiter.set(rateKey, userLimit);

    await conn.sendPresenceUpdate('composing', from).catch(() => {});

    const systemPrompt = `You are INSIDIOUS V2, created by Stanley Assanaly, a 22-year-old Tanzanian software engineer. Be helpful and concise.`;

    try {
        const res = await axios.get(globalSettings.aiApiUrl + encodeURIComponent(body) + '?system=' + encodeURIComponent(systemPrompt), { timeout: 15000 });
        await conn.sendMessage(from, {
            text: fancy(res.data),
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: globalSettings.newsletterJid,
                    newsletterName: globalSettings.botName
                }
            }
        }, { quoted: msg });
        return true;
    } catch (e) {
        console.error('AI error:', e);
        return false;
    }
}

// ==================== COMMAND LOADER ====================
async function loadCommands(dir) {
    const commands = new Map();
    try {
        const items = await fs.readdir(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                const subCommands = await loadCommands(fullPath);
                subCommands.forEach((cmd, name) => commands.set(name, cmd));
            } else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const cmd = require(fullPath);
                    const cmdName = path.basename(item, '.js');
                    if (cmd.name) commands.set(cmd.name, cmd);
                    if (cmd.aliases?.length) cmd.aliases.forEach(alias => commands.set(alias, cmd));
                    if (!cmd.name || cmd.name !== cmdName) commands.set(cmdName, cmd);
                } catch (e) {
                    console.error(`Failed to load ${fullPath}:`, e);
                }
            }
        }
    } catch (e) {
        console.error('Load commands error:', e);
    }
    return commands;
}

// ==================== COMMAND HANDLER ====================
async function handleCommand(conn, msg, body, from, sender) {
    try {
        let prefix = globalSettings.prefix;
        let commandName = '';
        let args = [];

        if (body.startsWith(prefix)) {
            const parts = body.slice(prefix.length).trim().split(/ +/);
            commandName = parts.shift().toLowerCase();
            args = parts;
        } else {
            return false;
        }

        const isGroup = from.endsWith('@g.us');
        let isGroupAdmin = false;
        if (isGroup) {
            isGroupAdmin = await isParticipantAdmin(conn, from, sender);
        }
        
        const senderNumber = sender.split('@')[0];
        const isDeployerUser = isDeployer(senderNumber);
        const isCoOwnerUser = isCoOwner(senderNumber);
        const isOwnerUser = isDeployerUser || isCoOwnerUser || msg.key.fromMe;

        // Mode check
        if (globalSettings.mode === 'self' && !isOwnerUser) {
            await msg.reply(fancy('❌ Bot is in private mode.'));
            return true;
        }

        const command = global.commands?.get(commandName);
        if (!command) return false;

        if (command.ownerOnly && !isOwnerUser) {
            await msg.reply(fancy('❌ Owner only!'));
            return true;
        }
        if (command.adminOnly && !isGroupAdmin && !isOwnerUser) {
            await msg.reply(fancy('❌ Admin only!'));
            return true;
        }

        await command.execute(conn, msg, args, {
            from,
            sender,
            fancy,
            config,
            isOwner: isOwnerUser,
            isDeployer: isDeployerUser,
            isCoOwner: isCoOwnerUser,
            isGroupAdmin,
            reply: msg.reply,
            botId: botSecretId,
            canPairNumber,
            pairNumber,
            unpairNumber,
            getPairedNumbers: () => Array.from(pairedNumbers),
            isBotAdmin: (jid) => isBotAdmin(conn, jid),
            isParticipantAdmin: (jid, p) => isParticipantAdmin(conn, jid, p),
            getGroupSetting: () => globalSettings,
            setGroupSetting: async (k, v) => {
                globalSettings[k] = v;
                await saveGlobalSettings();
            }
        });
        return true;
    } catch (e) {
        console.error('Command handler error:', e);
        return false;
    }
}

// ==================== MAIN HANDLER ====================
module.exports = async (conn, m) => {
    try {
        if (!m.messages?.[0]) return;
        let msg = m.messages[0];
        if (!msg.message) return;

        // Status broadcasts
        if (msg.key.remoteJid === 'status@broadcast') {
            await handleAutoStatus(conn, msg);
            return;
        }

        msg = enhanceMessage(conn, msg);

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        const body = extractMessageText(msg);

        const isGroup = from.endsWith('@g.us');
        const isDeployerUser = isDeployer(senderNumber);
        const isCoOwnerUser = isCoOwner(senderNumber);
        const isOwnerUser = msg.key.fromMe || isDeployerUser || isCoOwnerUser;

        let isGroupAdmin = false;
        if (isGroup) {
            isGroupAdmin = await isParticipantAdmin(conn, from, sender);
        }
        const isExempt = isOwnerUser || isGroupAdmin;

        // Store message for anti-delete
        if (body) {
            messageStore.set(msg.key.id, { content: body, sender, timestamp: new Date() });
            if (messageStore.size > MAX_STORE_SIZE) {
                const firstKey = messageStore.keys().next().value;
                messageStore.delete(firstKey);
            }
        }

        // Auto features
        if (globalSettings.autoRead) {
            await conn.readMessages([msg.key]).catch(() => {});
        }
        if (globalSettings.autoTyping) {
            await conn.sendPresenceUpdate('composing', from).catch(() => {});
        }
        if (globalSettings.autoRecording && !isGroup) {
            await conn.sendPresenceUpdate('recording', from).catch(() => {});
        }
        if (globalSettings.autoReact && !msg.key.fromMe) {
            const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
            await conn.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
        }

        // Security features (skip if exempt)
        if (!isExempt) {
            if (await handleAntiSpam(conn, msg, from, sender)) return;
            if (await handleAntiBugs(conn, msg, body, from, sender)) return;        // NEW
            if (await handleAntiBot(conn, msg, body, from, sender)) return;         // NEW
            if (await handleAntiMentionSpam(conn, msg, from, sender)) return;      // NEW
        }

        // Always run
        await handleViewOnce(conn, msg);
        await handleAntiDelete(conn, msg);

        // Group security
        if (isGroup && !isExempt) {
            if (await handleAntiLink(conn, msg, body, from, sender)) return;
            if (await handleAntiScam(conn, msg, body, from, sender)) return;
            if (await handleAntiPorn(conn, msg, body, from, sender)) return;
            if (await handleAntiMedia(conn, msg, from, sender)) return;
            if (await handleAntiTag(conn, msg, from, sender)) return;
        }

        // Commands
        if (body && await handleCommand(conn, msg, body, from, sender)) return;

        // Chatbot
        if (body && !body.startsWith(globalSettings.prefix) && !isOwnerUser) {
            await handleChatbot(conn, msg, from, body, sender);
        }

        trackActivity(sender);

    } catch (err) {
        console.error('Handler Error:', err);
    }
};

// ==================== GROUP UPDATE HANDLER ====================
module.exports.handleGroupUpdate = async (conn, update) => {
    const { id, participants, action } = update;
    if (action === 'add') {
        for (const p of participants) {
            await handleWelcome(conn, p, id, 'add');
        }
    } else if (action === 'remove') {
        for (const p of participants) {
            await handleWelcome(conn, p, id, 'remove');
        }
    }
};

// ==================== CALL HANDLER ====================
module.exports.handleCall = async (conn, call) => {
    await handleAntiCall(conn, call);
};

// ==================== INITIALIZATION ====================
module.exports.init = async (conn) => {
    console.log(fancy('[SYSTEM] Initializing INSIDIOUS V2...'));
    
    await loadGlobalSettings();
    await loadPairedNumbers();

    // Load commands
    const cmdPath = path.join(__dirname, 'commands');
    if (await fs.pathExists(cmdPath)) {
        global.commands = await loadCommands(cmdPath);
        console.log(fancy(`📁 Loaded ${global.commands.size} commands`));
    }

    // Intervals
    if (globalSettings.autoBio) {
        setInterval(() => updateAutoBio(conn), 60000);
    }

    console.log(fancy(`🔐 Bot ID: ${botSecretId}`));
    console.log(fancy(`🌐 Mode: ${globalSettings.mode}`));
    console.log(fancy(`👥 Co-owners: ${Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n)).length}/${globalSettings.maxCoOwners}`));
    console.log(fancy('✅ All systems ready'));

    // Welcome owners
    for (const num of config.ownerNumber) {
        try {
            await conn.sendMessage(num + '@s.whatsapp.net', {
                image: { url: globalSettings.aliveImage },
                caption: fancy(`✅ *INSIDIOUS V2 CONNECTED*\n\n🔐 Bot ID: ${botSecretId}\n🌐 Mode: ${globalSettings.mode}\n⚡ Status: ONLINE\n\n🛡️ Anti-Bugs: ${globalSettings.antibugs ? '✅' : '❌'}\n🤖 Anti-Bot: ${globalSettings.antibot ? '✅' : '❌'}\n📢 Anti-Mention: ${globalSettings.antimentionspam ? '✅' : '❌'}`)
            });
        } catch {}
    }
};

// ==================== EXPORTS ====================
module.exports.pairNumber = pairNumber;
module.exports.unpairNumber = unpairNumber;
module.exports.getPairedNumbers = () => Array.from(pairedNumbers);
module.exports.getBotId = () => botSecretId;
module.exports.isDeployer = isDeployer;
module.exports.isCoOwner = isCoOwner;
module.exports.isOwner = isOwner;
module.exports.canPairNumber = canPairNumber;
module.exports.loadGlobalSettings = loadGlobalSettings;
module.exports.saveGlobalSettings = saveGlobalSettings;
module.exports.refreshConfig = async () => {
    await loadGlobalSettings();
    const cmdPath = path.join(__dirname, 'commands');
    if (await fs.pathExists(cmdPath)) {
        global.commands = await loadCommands(cmdPath);
    }
};
