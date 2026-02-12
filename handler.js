const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const ytdl = require('ytdl-core');
const cheerio = require('cheerio');

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
    botName: 'INSIDIOUS:THE LAST KEY',
    developer: 'STANYTZ',
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

    // ========== ANTI / SECURITY FEATURES ==========
    antilink: true,
    antiporn: true,
    antiscam: true,
    antimedia: true,
    antitag: true,
    antiviewonce: true,
    antidelete: true,
    sleepingmode: true,
    antibugs: true,
    antispam: true,
    anticall: true,

    // ========== AUTO FEATURES ==========
    autoRead: true,
    autoReact: true,
    autoTyping: true,
    autoRecording: true,
    autoBio: true,
    autostatus: true,
    downloadStatus: true,

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

    // ========== KEYWORDS (ARRAYS) ==========
    scamKeywords: ['win', 'prize', 'lottery', 'congratulations', 'million', 'inheritance', 'selected'],
    pornKeywords: ['xxx', 'porn', 'sex', 'nude', 'adult', '18+', 'onlyfans'],
    blockedMediaTypes: ['photo', 'video', 'sticker'],
    blockedCountries: [],

    // ========== AUTO REACT / STATUS ==========
    autoReactEmojis: ['❤️', '🔥', '👍', '🎉', '👏', '⚡', '✨', '🌟'],
    autoStatusActions: ['view', 'react', 'reply'],

    // ========== API ==========
    quoteApiUrl: 'https://api.quotable.io/random',
    aiApiUrl: 'https://text.pollinations.ai/',
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
const userActivity = new Map();         // message count per user
const spamTracker = new Map();          // anti-spam
const inactiveTracker = new Map();      // last active timestamp
const statusCache = new Map();          // auto-status seen IDs
const bugReports = [];                 // anti-bugs report

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
async function applyAction(conn, from, sender, actionType, reason, warnIncrement = 1) {
    if (!from.endsWith('@g.us')) return;
    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) return;

    if (actionType === 'warn') {
        const warn = (warningTracker.get(sender) || 0) + warnIncrement;
        warningTracker.set(sender, warn);
        await conn.sendMessage(from, {
            text: fancy(`⚠️ @${sender.split('@')[0]} – ${reason} Warning ${warn}/${getGroupSetting(from, 'warnLimit')}`),
            mentions: [sender]
        }).catch(() => {});
        if (warn >= getGroupSetting(from, 'warnLimit')) {
            await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
            await conn.sendMessage(from, {
                text: fancy(`🚫 @${sender.split('@')[0]} removed: ${reason} (exceeded warnings)`),
                mentions: [sender]
            }).catch(() => {});
            warningTracker.delete(sender);
        }
    }
    if (actionType === 'remove') {
        await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
        await conn.sendMessage(from, {
            text: fancy(`🚫 @${sender.split('@')[0]} removed: ${reason}`),
            mentions: [sender]
        }).catch(() => {});
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
    await applyAction(conn, from, sender, 'warn', 'Links are not allowed', 1);
    return true;
}
async function handleAntiPorn(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antiporn')) return false;
    const keywords = getGroupSetting(from, 'pornKeywords');
    if (keywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Adult content is forbidden', 2);
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
            text: fancy(`⚠️ SCAM ALERT! @${sender.split('@')[0]} – Possible scam message.`),
            mentions: allMentions
        }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Scam content', 2);
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
    if ((blocked.includes('photo') && isPhoto) ||
        (blocked.includes('video') && isVideo) ||
        (blocked.includes('sticker') && isSticker) ||
        (blocked.includes('audio') && isAudio) ||
        (blocked.includes('document') && isDocument) ||
        (blocked.includes('all') && (isPhoto || isVideo || isSticker || isAudio || isDocument))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyAction(conn, from, sender, 'warn', 'Media type not allowed', 1);
        return true;
    }
    return false;
}
async function handleAntiTag(conn, msg, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antitag')) return false;
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentions || mentions.length < getGroupSetting(from, 'maxTags')) return false;
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    await applyAction(conn, from, sender, 'warn', 'Excessive tagging', 1);
    return true;
}
async function handleViewOnce(conn, msg) {
    if (!getGroupSetting('global', 'antiviewonce')) return false;
    if (!msg.message?.viewOnceMessageV2 && !msg.message?.viewOnceMessage) return false;
    for (const num of config.ownerNumber) {
        await conn.sendMessage(num + '@s.whatsapp.net', {
            forward: msg,
            caption: fancy('INSIDIOUS VIEW ONCE RECOVERY\n' +
                `From: @${msg.key.participant?.split('@')[0] || 'Unknown'}\n` +
                `Time: ${new Date().toLocaleString()}\n` +
                `Type: ViewOnce`),
            contextInfo: { mentionedJid: [msg.key.participant] }
        }).catch(() => {});
    }
    return true;
}
async function handleAntiDelete(conn, msg) {
    if (!getGroupSetting('global', 'antidelete')) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) return false;
    const stored = messageStore.get(msg.message.protocolMessage.key.id);
    if (!stored) return false;
    for (const num of config.ownerNumber) {
        await conn.sendMessage(num + '@s.whatsapp.net', {
            text: `🗑️ *DELETED MESSAGE RECOVERED*\n\nFrom: @${stored.sender.split('@')[0]}\nMessage: ${stored.content}`,
            mentions: [stored.sender]
        }).catch(() => {});
    }
    messageStore.delete(msg.message.protocolMessage.key.id);
    return true;
}
async function handleAntiBugs(conn, msg, from, sender) {
    if (!globalSettings.antibugs) return false;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    if (body.length > 10000 || /[\uD800-\uDFFF]{10,}/.test(body) || /[\u200B-\u200D]{50,}/.test(body)) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await conn.updateBlockStatus(sender, 'block').catch(() => {});
        bugReports.push({
            timestamp: new Date(),
            sender,
            message: body.slice(0, 100),
            action: 'blocked'
        });
        for (const num of config.ownerNumber) {
            await conn.sendMessage(num + '@s.whatsapp.net', {
                text: fancy(`⚠️ *BUG DETECTED*\nSender: ${sender}\nMessage: ${body.slice(0, 200)}...\nBlocked and reported.`)
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
        await applyAction(conn, from, sender, 'warn', 'Spamming', 1);
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

// ==================== AUTO FEATURES ====================
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
        const caption = statusMsg.message?.imageMessage?.caption || statusMsg.message?.videoMessage?.caption || statusMsg.message?.conversation || '';
        if (caption) {
            try {
                const res = await axios.get(globalSettings.aiApiUrl + encodeURIComponent(caption) + '?system=Reply to this status warmly.');
                await conn.sendMessage(statusMsg.key.participant, { text: fancy(res.data) }).catch(() => {});
            } catch {}
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
setInterval(() => { if (globalSettings.autoBio) updateAutoBio(conn); }, 60000);
async function handleAutoBlockCountry(conn, participant) {
    if (!globalSettings.autoblockCountry) return false;
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

// ==================== WELCOME / GOODBYE ====================
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
    let caption = '';
    if (action === 'add') {
        caption = fancy(`🎉 *WELCOME TO ${group.toUpperCase()}!*\n\n` +
            `👤 Name: ${name}\n` +
            `📞 Phone: ${getUsername(participant)}\n` +
            `🕐 Joined: ${new Date().toLocaleString()}\n` +
            `👥 Total Members: ${total}\n` +
            `💬 Quote: "${quote}"`);
    } else {
        caption = fancy(`👋 *GOODBYE!*\n\n` +
            `👤 Name: ${name}\n` +
            `📞 Phone: ${getUsername(participant)}\n` +
            `🕐 Left: ${new Date().toLocaleString()}\n` +
            `👥 Total Members: ${total}\n` +
            `💬 Quote: "${quote}"`);
    }
    await conn.sendMessage(groupJid, { text: caption, mentions: [participant] }).catch(() => {});
}

// ==================== ACTIVE MEMBERS & AUTO REMOVE INACTIVE ====================
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
            await conn.sendMessage(jid, { text: fancy(`🧹 Removed ${toRemove.length} inactive members (${inactiveDays} days no activity).`) }).catch(() => {});
        }
    }
}
setInterval(() => { if (globalSettings.activemembers) autoRemoveInactive(conn); }, 24 * 60 * 60 * 1000);

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

// ==================== CHATBOT ====================
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
        const url = globalSettings.aiApiUrl + encodeURIComponent(body) + '?system=You are INSIDIOUS V2. Reply humanly in the same language as the user.';
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

// ==================== DOWNLOADER ====================
async function handleDownload(conn, msg, args, type) {
    const url = args[0];
    if (!url) return msg.reply(fancy(`❌ Please provide a URL`));
    try {
        if (type === 'yt' || type === 'ytaudio' || type === 'ytvideo') {
            const info = await ytdl.getInfo(url);
            const format = type === 'ytaudio' ? ytdl.chooseFormat(info.formats, { filter: 'audioonly' }) : ytdl.chooseFormat(info.formats, { quality: 'highest' });
            const stream = ytdl(url, { format });
            const buffer = await streamToBuffer(stream);
            await conn.sendMessage(msg.key.remoteJid, {
                [type === 'ytaudio' ? 'audio' : 'video']: buffer,
                mimetype: type === 'ytaudio' ? 'audio/mpeg' : 'video/mp4',
                fileName: `${info.videoDetails.title}.${type === 'ytaudio' ? 'mp3' : 'mp4'}`,
                caption: fancy(`✅ Downloaded: ${info.videoDetails.title}`)
            }, { quoted: msg }).catch(() => {});
        } else if (type === 'tiktok') {
            const res = await axios.get(`https://api.tikmate.cc/?url=${encodeURIComponent(url)}`);
            const videoUrl = res.data.video;
            const videoBuffer = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            await conn.sendMessage(msg.key.remoteJid, { video: videoBuffer.data, caption: fancy('✅ TikTok video') }, { quoted: msg }).catch(() => {});
        }
    } catch (e) {
        await msg.reply(fancy(`❌ Download failed: ${e.message}`));
    }
}
function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
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

        // Load latest settings
        await loadGlobalSettings();
        await loadGroupSettings();

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

        // Store message for anti-delete
        if (body) messageStore.set(msg.key.id, { content: body, sender, timestamp: new Date() });
        if (messageStore.size > 1000) {
            const keys = Array.from(messageStore.keys()).slice(0, 200);
            keys.forEach(k => messageStore.delete(k));
        }

        // Auto presence
        if (globalSettings.autoTyping) await conn.sendPresenceUpdate('composing', from).catch(() => {});
        if (globalSettings.autoRecording && !isGroup) await conn.sendPresenceUpdate('recording', from).catch(() => {});
        if (globalSettings.autoRead) await conn.readMessages([msg.key]).catch(() => {});
        if (globalSettings.autoReact && !msg.key.fromMe && !isChannel) {
            const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
            await conn.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
        }

        // Anti bugs (high priority)
        if (await handleAntiBugs(conn, msg, from, sender)) return;

        // Anti spam
        if (await handleAntiSpam(conn, msg, from, sender)) return;

        // View once & anti delete
        await handleViewOnce(conn, msg);
        await handleAntiDelete(conn, msg);

        // Country block on new participants
        if (msg.message?.protocolMessage?.type === 0 && isGroup) {
            const participants = msg.message.protocolMessage.participantJidList || [];
            for (const p of participants) {
                await handleAutoBlockCountry(conn, p);
            }
        }

        // ---- COMMANDS ----
        // (commands are handled by the command handler; this is just the main event loop)
        // The command handler is separate; this file only provides the anti-features and utilities.
        // We call the command handler from index.js, not here.

        // ---- GROUP SECURITY (non-owners) ----
        if (isGroup && !isOwner) {
            if (await handleAntiLink(conn, msg, body, from, sender)) return;
            if (await handleAntiScam(conn, msg, body, from, sender)) return;
            if (await handleAntiPorn(conn, msg, body, from, sender)) return;
            if (await handleAntiMedia(conn, msg, from, sender)) return;
            if (await handleAntiTag(conn, msg, from, sender)) return;
        }

        // ---- CHATBOT (private + group mentions) ----
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
            await handleAutoBlockCountry(conn, p);
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
    console.log(fancy(`🔐 Bot ID: ${botSecretId}`));
    console.log(fancy(`🌐 Mode: ${globalSettings.mode.toUpperCase()}`));
    console.log(fancy(`📋 Co‑owners: ${Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n)).length}/${globalSettings.maxCoOwners}`));
    // Auto-follow channels
    for (const ch of globalSettings.autoFollowChannels) {
        try { await conn.groupAcceptInvite(ch.split('@')[0]); } catch {}
    }
    // Send welcome to deployer
    if (config.ownerNumber.length) {
        const jid = config.ownerNumber[0] + '@s.whatsapp.net';
        try {
            await conn.sendMessage(jid, {
                image: { url: globalSettings.aliveImage },
                caption: fancy(`╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 Name: ${globalSettings.botName}
📞 Number: ${conn.user.id.split(':')[0]}
🔐 Bot ID: ${botSecretId}
🌐 Mode: ${globalSettings.mode.toUpperCase()}
⚡ Status: ONLINE

👑 Developer: ${globalSettings.developer}
💾 Version: ${globalSettings.version} | ${globalSettings.year}

📊 *ALL SECURITY FEATURES: ACTIVE & CONFIGURABLE*`),
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
module.exports.loadSettings = loadGlobalSettings;  // alias for command
module.exports.saveSettings = saveGlobalSettings;  // alias for command
module.exports.refreshConfig = async () => {
    await loadGlobalSettings();
    await loadGroupSettings();
    Object.assign(globalSettings, await loadGlobalSettings()); // ensure fresh
};