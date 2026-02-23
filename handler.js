const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');

// ==================== LOAD CONFIG ====================
let config = {};
try { config = require('./config'); } catch { config = {}; }

config.ownerNumber = (config.ownerNumber || [])
    .map(num => num.replace(/[^0-9]/g, ''))
    .filter(num => num.length >= 10);

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
    antistatusmention: true,          // NEW FEATURE

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

    // ========== KEYWORDS ==========
    scamKeywords: ['win', 'prize', 'lottery', 'congratulations', 'million', 'inheritance', 'selected'],
    pornKeywords: ['xxx', 'porn', 'sex', 'nude', 'adult', '18+', 'onlyfans'],
    blockedMediaTypes: ['photo', 'video', 'sticker'],
    blockedCountries: [],

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

    // ========== ANTI STATUS MENTION SETTINGS ==========
    antiStatusMentionAction: 'warn',   // 'warn', 'block', or 'report'
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
const messageStore = new Map();          // anti-delete
const warningTracker = new Map();       // per-user warn count
const spamTracker = new Map();          // anti-spam
const inactiveTracker = new Map();      // last active timestamp
const statusCache = new Map();          // auto-status seen IDs

let statusReplyCount = 0;
let lastReset = Date.now();

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

// ==================== UNIVERSAL MESSAGE EXTRACTOR ====================
function extractMessageText(msg) {
    try {
        if (!msg.message) return '';

        const type = Object.keys(msg.message)[0];
        let body = '';

        if (type === 'conversation') {
            body = msg.message.conversation || '';
        }
        else if (type === 'extendedTextMessage') {
            body = msg.message.extendedTextMessage.text || '';
        }
        else if (type === 'buttonsResponseMessage') {
            body = msg.message.buttonsResponseMessage.selectedButtonId || '';
        }
        else if (type === 'templateButtonReplyMessage') {
            body = msg.message.templateButtonReplyMessage.selectedId || '';
        }
        else if (type === 'interactiveResponseMessage') {
            const nativeFlow = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage;
            if (nativeFlow && nativeFlow.paramsJson) {
                const parsed = JSON.parse(nativeFlow.paramsJson);
                body = parsed.id || '';
            }
        }
        else if (type === 'imageMessage') {
            body = msg.message.imageMessage.caption || '';
        }
        else if (type === 'videoMessage') {
            body = msg.message.videoMessage.caption || '';
        }
        else if (type === 'documentMessage') {
            body = msg.message.documentMessage.caption || '';
        }
        else if (type === 'viewOnceMessage') {
            const subMsg = msg.message.viewOnceMessage.message;
            if (subMsg) {
                return extractMessageText({ message: subMsg });
            }
        }
        return body.trim();
    } catch (e) {
        console.error('Error extracting message text:', e);
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
        const warnLimit = getGroupSetting(from, 'warnLimit');
        
        let message = '';
        if (customMessage) {
            message = customMessage;
        } else {
            message = `⚠️ ${userTag} (${userName}) – You violated rule: *${reason}*. Your message has been deleted. Warning ${warn}/${warnLimit}.`;
        }
        
        await conn.sendMessage(from, { text: fancy(message), mentions: mention }).catch(() => {});
        
        if (warn >= warnLimit) {
            await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
            const removeMsg = `🚫 ${userTag} (${userName}) – You have been removed from the group. Reason: *${reason}* (exceeded ${warnLimit} warnings).`;
            await conn.sendMessage(from, { text: fancy(removeMsg), mentions: mention }).catch(() => {});
            warningTracker.delete(sender);
        }
    } else if (actionType === 'remove') {
        await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
        const removeMsg = `🚫 ${userTag} (${userName}) – You have been removed from the group. Reason: *${reason}*.`;
        await conn.sendMessage(from, { text: fancy(removeMsg), mentions: mention }).catch(() => {});
    } else if (actionType === 'block') {
        await conn.updateBlockStatus(sender, 'block').catch(() => {});
    }
}

// ==================== ANTI FEATURES ====================
async function handleAntiLink(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antilink')) return false;
    const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-\/a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    if (!linkRegex.test(body)) return false;
    
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    const userName = await getContactName(conn, sender);
    const customMsg = `⚠️ @${sender.split('@')[0]} (${userName}) – You sent a *LINK*! Your message has been deleted. Links are not allowed in this group. Warning`;
    await applyAction(conn, from, sender, 'warn', 'Sending links', 1, customMsg);
    return true;
}
async function handleAntiPorn(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antiporn')) return false;
    const keywords = getGroupSetting(from, 'pornKeywords');
    if (keywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        const userName = await getContactName(conn, sender);
        const customMsg = `⚠️ @${sender.split('@')[0]} (${userName}) – You sent *ADULT/EXPLICIT CONTENT*! Your message has been deleted. This is strictly forbidden. Warning`;
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
        const userName = await getContactName(conn, sender);
        await conn.sendMessage(from, {
            text: fancy(`⚠️ *SCAM ALERT!* @${sender.split('@')[0]} (${userName}) sent a message that appears to be a scam. The message has been deleted. Do not engage.`),
            mentions: allMentions
        }).catch(() => {});
        const customMsg = `⚠️ @${sender.split('@')[0]} (${userName}) – You sent a *SCAM MESSAGE*! Your message has been deleted. This puts members at risk. Warning`;
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
    
    let mediaType = isPhoto ? 'PHOTO' : isVideo ? 'VIDEO' : isSticker ? 'STICKER' : isAudio ? 'AUDIO' : isDocument ? 'DOCUMENT' : '';
    if ((blocked.includes('photo') && isPhoto) ||
        (blocked.includes('video') && isVideo) ||
        (blocked.includes('sticker') && isSticker) ||
        (blocked.includes('audio') && isAudio) ||
        (blocked.includes('document') && isDocument) ||
        (blocked.includes('all') && (isPhoto || isVideo || isSticker || isAudio || isDocument))) {
        
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        const userName = await getContactName(conn, sender);
        const customMsg = `⚠️ @${sender.split('@')[0]} (${userName}) – You sent a *${mediaType}*! This media type is not allowed. Your message has been deleted. Warning`;
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
    const userName = await getContactName(conn, sender);
    const customMsg = `⚠️ @${sender.split('@')[0]} (${userName}) – You tagged ${mentions.length} people! Excessive tagging is not allowed. Your message has been deleted. Warning`;
    await applyAction(conn, from, sender, 'warn', 'Excessive tagging', 1, customMsg);
    return true;
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
        const userName = await getContactName(conn, sender);
        const customMsg = `⚠️ @${sender.split('@')[0]} (${userName}) – You are sending messages too fast! Please slow down. Warning`;
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
async function handleViewOnce(conn, msg) {
    if (!getGroupSetting('global', 'antiviewonce')) return false;
    if (!msg.message?.viewOnceMessageV2 && !msg.message?.viewOnceMessage) return false;
    const scope = getGroupSetting('global', 'antiviewonceScope') || 'all';
    if (scope === 'group' && !msg.key.remoteJid.endsWith('@g.us')) return false;
    if (scope === 'private' && msg.key.remoteJid.endsWith('@g.us')) return false;
    for (const num of config.ownerNumber) {
        const sentMsg = await conn.sendMessage(num + '@s.whatsapp.net', {
            forward: msg,
            caption: fancy('INSIDIOUS VIEW ONCE RECOVERY\n' +
                `From: @${msg.key.participant?.split('@')[0] || 'Unknown'}\n` +
                `Time: ${new Date().toLocaleString()}\n` +
                `Type: ViewOnce`),
            contextInfo: { mentionedJid: [msg.key.participant] }
        }).catch(() => {});
        if (sentMsg && globalSettings.autoDeleteMessages && globalSettings.autoExpireMinutes > 0) {
            setTimeout(async () => {
                try { await conn.sendMessage(num + '@s.whatsapp.net', { delete: sentMsg.key }); } catch {}
            }, globalSettings.autoExpireMinutes * 60 * 1000);
        }
    }
    return true;
}
async function handleAntiDelete(conn, msg) {
    if (!getGroupSetting('global', 'antidelete')) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) return false;
    const stored = messageStore.get(msg.message.protocolMessage.key.id);
    if (!stored) return false;
    const scope = getGroupSetting('global', 'antideleteScope') || 'all';
    const isGroup = stored.sender.includes('@g.us');
    if (scope === 'group' && !isGroup) return false;
    if (scope === 'private' && isGroup) return false;
    for (const num of config.ownerNumber) {
        const sentMsg = await conn.sendMessage(num + '@s.whatsapp.net', {
            text: `🗑️ *DELETED MESSAGE RECOVERED*\n\nFrom: @${stored.sender.split('@')[0]}\nMessage: ${stored.content}`,
            mentions: [stored.sender]
        }).catch(() => {});
        if (sentMsg && globalSettings.autoDeleteMessages && globalSettings.autoExpireMinutes > 0) {
            setTimeout(async () => {
                try { await conn.sendMessage(num + '@s.whatsapp.net', { delete: sentMsg.key }); } catch {}
            }, globalSettings.autoExpireMinutes * 60 * 1000);
        }
    }
    messageStore.delete(msg.message.protocolMessage.key.id);
    return true;
}

// ==================== ANTI STATUS MENTION ====================
async function handleAntiStatusMention(conn, msg, sender) {
    if (!globalSettings.antistatusmention) return false;
    
    // Check if the status message mentions the bot
    const botJid = conn.user.id; // e.g. "1234567890:5@s.whatsapp.net"
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentionedJids.includes(botJid)) return false;

    const action = globalSettings.antiStatusMentionAction || 'warn';
    const userName = await getContactName(conn, sender);

    if (action === 'warn') {
        // Send a warning message to the user (private chat)
        await conn.sendMessage(sender, {
            text: fancy(`⚠️ Hello ${userName},\n\nYou mentioned the bot (@${botJid.split('@')[0]}) in your status. This is not allowed. Please refrain from doing so again.`),
            mentions: [sender]
        }).catch(() => {});
    } else if (action === 'block') {
        await conn.updateBlockStatus(sender, 'block').catch(() => {});
    } else if (action === 'report') {
        // Forward the status to owners
        for (const num of config.ownerNumber) {
            await conn.sendMessage(num + '@s.whatsapp.net', {
                text: fancy(`🚨 *STATUS MENTION REPORT*\n\nUser: @${sender.split('@')[0]}\nMentioned bot in status.`),
                mentions: [sender]
            }).catch(() => {});
        }
    }
    return true;
}

// ==================== AUTO FEATURES ====================
async function handleAutoStatus(conn, msg) {
    if (!globalSettings.autostatus) return;
    if (msg.key.remoteJid !== 'status@broadcast') return;
    const actions = globalSettings.autoStatusActions;
    const statusId = msg.key.id;
    if (statusCache.has(statusId)) return;
    statusCache.set(statusId, true);
    if (statusCache.size > 500) {
        const keys = Array.from(statusCache.keys()).slice(0, 100);
        keys.forEach(k => statusCache.delete(k));
    }
    if (actions.includes('view')) {
        await conn.readMessages([msg.key]).catch(() => {});
    }
    if (actions.includes('react')) {
        const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
        await conn.sendMessage('status@broadcast', { react: { text: emoji, key: msg.key } }).catch(() => {});
    }
    if (actions.includes('reply')) {
        const now = Date.now();
        if (now - lastReset > 24*60*60*1000) {
            statusReplyCount = 0;
            lastReset = now;
        }
        if (statusReplyCount < globalSettings.statusReplyLimit) {
            const caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || msg.message?.conversation || '';
            if (caption) {
                try {
                    const res = await axios.get(globalSettings.aiApiUrl + encodeURIComponent(caption) + '?system=Reply to this status warmly.');
                    await conn.sendMessage(msg.key.participant, { text: fancy(res.data) }).catch(() => {});
                    statusReplyCount++;
                } catch {}
            }
        }
    }
}
async function updateAutoBio(conn) {
    if (!globalSettings.autoBio) return;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const bio = `${globalSettings.developer} | Uptime: ${hours}h ${minutes}m | INSIDIOUS V2`;
    await conn.updateProfileStatus(bio).catch(() => {});
}
async function handleAutoBlockCountry(conn, participant, isExempt = false) {
    if (!globalSettings.autoblockCountry || isExempt) return false;
    const blocked = globalSettings.blockedCountries || [];
    if (!blocked.length) return false;
    const number = participant.split('@')[0];
    const countryMatch = number.match(/^(\d{1,3})/);
    if (countryMatch && blocked.includes(countryMatch[1])) {
        await conn.updateBlockStatus(participant, 'block').catch(() => {});
        return true;
    }
    return false;
}
async function autoSaveContact(conn, sender, from, isGroup) {
    if (!globalSettings.autoSaveContact || isGroup || sender === conn.user.id) return;
    const contactFile = path.join(__dirname, 'contacts.json');
    let contacts = {};
    try { contacts = await fs.readJson(contactFile); } catch {}
    if (!contacts[sender]) {
        const name = await getContactName(conn, sender);
        contacts[sender] = { name, firstSeen: new Date().toISOString() };
        await fs.writeJson(contactFile, contacts);
    }
}

// ==================== WELCOME / GOODBYE (plain group link) ====================
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    if (!getGroupSetting(groupJid, 'welcomeGoodbye')) return;
    const isAdmin = await isBotAdmin(conn, groupJid);
    if (!isAdmin) return;

    const name = await getContactName(conn, participant);
    const group = await getGroupName(conn, groupJid);
    const meta = await conn.groupMetadata(groupJid);
    const total = meta.participants.length;
    let quote = '';
    try {
        const res = await axios.get(globalSettings.quoteApiUrl);
        quote = res.data.content;
    } catch { quote = 'Welcome to the family!'; }

    let profilePic;
    try {
        const picUrl = await conn.profilePictureUrl(participant, 'image');
        const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
        profilePic = await prepareWAMessageMedia({ image: { url: picUrl } }, { upload: conn.waUploadToServer });
    } catch {}

    const desc = meta.desc || 'No description';
    const activeThreshold = Date.now() - (getGroupSetting(groupJid, 'inactiveDays') * 24 * 60 * 60 * 1000);
    let activeCount = 0;
    for (const [jid, lastSeen] of inactiveTracker) {
        if (lastSeen > activeThreshold) activeCount++;
    }

    const userTag = `@${participant.split('@')[0]}`;
    const mentions = [participant];

    const header = action === 'add' ? `🎉 WELCOME TO ${group.toUpperCase()}!` : `👋 GOODBYE!`;
    const bodyPlain = `👤 Name: ${name}\n📞 Phone: ${userTag}\n🕐 ${action === 'add' ? 'Joined' : 'Left'}: ${new Date().toLocaleString()}\n📝 Description: ${desc}\n👥 Total Members: ${total}\n✨ Active Members: ${activeCount}\n🔗 Group Link: ${globalSettings.requiredGroupInvite}\n💬 Quote: "${quote}"`;

    const headerFancy = fancy(`╭━━━━━━━━━━━━━━╮\n   ${header}\n╰━━━━━━━━━━━━━━╯\n\n`);
    const messageText = headerFancy + bodyPlain;

    if (profilePic) {
        await conn.sendMessage(groupJid, { image: profilePic.imageMessage, caption: messageText, mentions }).catch(() => {});
    } else {
        await conn.sendMessage(groupJid, { text: messageText, mentions }).catch(() => {});
    }
}
function trackActivity(userJid) {
    inactiveTracker.set(userJid, Date.now());
}
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
            await conn.sendMessage(jid, { text: fancy(`🧹 Removed ${toRemove.length} inactive members (${inactiveDays} days without activity).`) }).catch(() => {});
        }
    }
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

// ==================== AI CHATBOT WITH DEVELOPER INFO ====================
async function handleChatbot(conn, msg, from, body, sender) {
    if (!getGroupSetting(from, 'chatbot') && !getGroupSetting('global', 'chatbot')) return false;
    const scope = getGroupSetting(from, 'chatbotScope') || 'all';
    const isGroup = from.endsWith('@g.us');
    if (scope === 'group' && !isGroup) return false;
    if (scope === 'private' && isGroup) return false;

    if (isGroup) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.stanzaId &&
                             msg.message.extendedTextMessage.contextInfo.participant === botJid;
        if (!mentioned.includes(botJid) && !isReplyToBot) return false;
    }
    await conn.sendPresenceUpdate('composing', from);

    const systemPrompt = `You are INSIDIOUS V2, an advanced WhatsApp automation bot created by Stanley Assanaly. 
Stanley is a 22-year-old Tanzanian software engineer, electrical engineer, and tech innovator. He graduated from Shinyanga Technical College in 2024. He is a skilled web developer (frontend and backend), and has built various projects including an Aviator predictor, Mines predictor, live streaming app, and more. He is also known for his expertise in casino-related tools and is a famous person in his field. He lives in Mwanza. 
When asked about your developer, proudly introduce Stanley with all his details. Always reply in the same language as the user, be helpful, friendly, and concise.`;

    try {
        const url = globalSettings.aiApiUrl + encodeURIComponent(body) + '?system=' + encodeURIComponent(systemPrompt);
        const res = await axios.get(url, { timeout: 10000 });
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
        }, { quoted: msg }).catch(() => {});
        return true;
    } catch { return false; }
}

// ==================== RECURSIVE COMMAND LOADER ====================
async function loadCommands(dir, baseDir = dir) {
    const commands = new Map();
    const items = await fs.readdir(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            const subCommands = await loadCommands(fullPath, baseDir);
            subCommands.forEach((cmd, name) => commands.set(name, cmd));
        } else if (item.endsWith('.js')) {
            try {
                const cmd = require(fullPath);
                const cmdName = path.basename(item, '.js');
                if (cmd.name) commands.set(cmd.name, cmd);
                if (cmd.aliases && Array.isArray(cmd.aliases)) {
                    cmd.aliases.forEach(alias => commands.set(alias, cmd));
                }
                if (!cmd.name || cmd.name !== cmdName) {
                    commands.set(cmdName, cmd);
                }
            } catch (e) {
                console.error(`Failed to load command ${fullPath}:`, e);
            }
        }
    }
    return commands;
}

// ==================== COMMAND HANDLER ====================
async function handleCommand(conn, msg, body, from, sender, isOwner, isDeployerUser, isCoOwnerUser) {
    let prefix = globalSettings.prefix;
    let commandName = '';
    let args = [];

    if (body.startsWith(prefix)) {
        const parts = body.slice(prefix.length).trim().split(/ +/);
        commandName = parts.shift().toLowerCase();
        args = parts;
    } else if (globalSettings.commandWithoutPrefix) {
        const parts = body.trim().split(/ +/);
        const firstWord = parts[0].toLowerCase();
        if (global.commands && global.commands.has(firstWord)) {
            commandName = firstWord;
            args = parts.slice(1);
        } else {
            return false;
        }
    } else {
        return false;
    }

    let isGroupAdmin = false;
    if (from.endsWith('@g.us')) {
        isGroupAdmin = await isParticipantAdmin(conn, from, sender);
    }
    const isPrivileged = isOwner || isGroupAdmin;

    // Required group check for non-privileged users
    if (!isPrivileged && globalSettings.requiredGroupJid) {
        const inGroup = await isUserInRequiredGroup(conn, sender);
        if (!inGroup) {
            await msg.reply(fancy(`❌ You must join our group to use this bot.\nJoin here: ${globalSettings.requiredGroupInvite}`));
            return true;
        }
    }

    // Mode check (only non-owners)
    if (globalSettings.mode === 'self' && !isOwner) {
        await msg.reply(fancy('❌ Bot is in private mode. Only owner can use commands.'));
        return true;
    }

    const command = global.commands ? global.commands.get(commandName) : null;
    if (command) {
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
                config,
                isOwner,
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
                isParticipantAdmin: (jid, participant) => isParticipantAdmin(conn, jid, participant),
                getGroupSetting: (jid, key) => getGroupSetting(jid, key),
                setGroupSetting: (jid, key, value) => setGroupSetting(jid, key, value)
            });
        } catch (e) {
            console.error(`Command error (${commandName}):`, e);
            await msg.reply(fancy(`❌ Command error: ${e.message}`));
        }
        return true;
    } else {
        await msg.reply(fancy(`❌ Command "${commandName}" not found`));
        return true;
    }
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
            await handleAntiStatusMention(conn, msg, msg.key.participant);  // NEW
            return;
        }

        // Load latest settings
        await loadGlobalSettings();
        await loadGroupSettings();

        msg = enhanceMessage(conn, msg);

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];

        // Extract message body
        const body = extractMessageText(msg);

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
        if (body) messageStore.set(msg.key.id, { content: body, sender, timestamp: new Date() });
        if (messageStore.size > 1000) {
            const keys = Array.from(messageStore.keys()).slice(0, 200);
            keys.forEach(k => messageStore.delete(k));
        }

        // Auto presence (with scope)
        const autoReadScope = getGroupSetting(from, 'autoReadScope') || 'all';
        if (getGroupSetting(from, 'autoRead') && (autoReadScope === 'all' || (autoReadScope === 'group' && isGroup) || (autoReadScope === 'private' && !isGroup))) {
            await conn.readMessages([msg.key]).catch(() => {});
        }
        const autoTypingEnabled = getGroupSetting(from, 'autoTyping');
        if (autoTypingEnabled) await conn.sendPresenceUpdate('composing', from).catch(() => {});
        const autoRecordingEnabled = getGroupSetting(from, 'autoRecording');
        if (autoRecordingEnabled && !isGroup) await conn.sendPresenceUpdate('recording', from).catch(() => {});
        const autoReactScope = getGroupSetting(from, 'autoReactScope') || 'all';
        if (getGroupSetting(from, 'autoReact') && !msg.key.fromMe && !isChannel && (autoReactScope === 'all' || (autoReactScope === 'group' && isGroup) || (autoReactScope === 'private' && !isGroup))) {
            const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
            await conn.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
        }

        // Auto save contact
        await autoSaveContact(conn, sender, from, isGroup);

        // ---- SECURITY FEATURES – SKIP IF EXEMPT ----
        if (!isExempt) {
            // Anti spam
            if (await handleAntiSpam(conn, msg, from, sender)) return;
        }

        // View once & anti delete – always run (recovery) but respect scope
        await handleViewOnce(conn, msg);
        await handleAntiDelete(conn, msg);

        // Country block on new participants
        if (msg.message?.protocolMessage?.type === 0 && isGroup) {
            const participants = msg.message.protocolMessage.participantJidList || [];
            for (const p of participants) {
                const pNumber = p.split('@')[0];
                const pIsOwner = isDeployer(pNumber) || isCoOwner(pNumber);
                let pIsGroupAdmin = false;
                if (!pIsOwner) {
                    pIsGroupAdmin = await isParticipantAdmin(conn, from, p);
                }
                const pIsExempt = pIsOwner || pIsGroupAdmin;
                await handleAutoBlockCountry(conn, p, pIsExempt);
            }
        }

        // ---- COMMANDS (executed before group security) ----
        if (body && await handleCommand(conn, msg, body, from, sender, isOwner, isDeployerUser, isCoOwnerUser)) return;

        // ---- GROUP SECURITY (non‑exempt) ----
        if (isGroup && !isExempt) {
            if (await handleAntiLink(conn, msg, body, from, sender)) return;
            if (await handleAntiScam(conn, msg, body, from, sender)) return;
            if (await handleAntiPorn(conn, msg, body, from, sender)) return;
            if (await handleAntiMedia(conn, msg, from, sender)) return;
            if (await handleAntiTag(conn, msg, from, sender)) return;
        }

        // ---- CHATBOT (respects scope) ----
        if (body && !body.startsWith(globalSettings.prefix) && !isOwner) {
            await handleChatbot(conn, msg, from, body, sender);
        }

        // Track activity for inactive removal
        trackActivity(sender);

    } catch (err) {
        console.error('Handler Error:', err);
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

    // Load commands recursively
    const cmdPath = path.join(__dirname, 'commands');
    if (await fs.pathExists(cmdPath)) {
        global.commands = await loadCommands(cmdPath);
        console.log(fancy(`📁 Loaded ${global.commands.size} commands.`));
    } else {
        global.commands = new Map();
        console.log(fancy('⚠️ Commands folder not found.'));
    }

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

    // Welcome message to owners
    const allOwners = config.ownerNumber.map(num => num + '@s.whatsapp.net');
    for (const ownerJid of allOwners) {
        try {
            const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
            const imageMedia = await prepareWAMessageMedia({ image: { url: globalSettings.aliveImage } }, { upload: conn.waUploadToServer });
            await conn.sendMessage(ownerJid, {
                image: imageMedia.imageMessage,
                caption: fancy(
                    `╭━━━━━━━━━━━━━━╮\n` +
                    `   ✅ *Bot Connected Successfully!*\n` +
                    `╰━━━━━━━━━━━━━━╯\n\n` +
                    `🤖 Name: ${globalSettings.botName}\n` +
                    `📞 Number: ${conn.user.id.split(':')[0]}\n` +
                    `🔐 Bot ID: ${botSecretId}\n` +
                    `🌐 Mode: ${globalSettings.mode.toUpperCase()}\n` +
                    `⚡ Status: ONLINE\n\n` +
                    `👑 Developer: Stanley Assanaly\n` +
                    `💾 Version: ${globalSettings.version} | ${globalSettings.year}\n\n` +
                    `📊 *ALL SECURITY FEATURES: ACTIVE & CONFIGURABLE*`
                ),
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
module.exports.refreshConfig = async () => {
    await loadGlobalSettings();
    await loadGroupSettings();
    Object.assign(globalSettings, await loadGlobalSettings());
};