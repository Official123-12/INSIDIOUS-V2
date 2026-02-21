const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const config = require('./config');
const { User, Group, Settings, Session, Ban, CommandStats } = require('./database/models');

// ==================== TOOLS ====================
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

// ✅ Format message – Ikiwa ni link, irudishe plain, vinginevyo ongeza border
function formatMessage(text) {
    if (!text) return text;
    // Detect WhatsApp invite link (chat.whatsapp.com/) or any http link
    if (text.includes('chat.whatsapp.com/') || text.includes('http://') || text.includes('https://')) {
        return text; // Return plain, clickable link
    }
    const topBorder = '╭─── • 🥀 • ───╮\n';
    const bottomBorder = '\n╰─── • 🥀 • ───╯';
    return topBorder + fancy(text) + bottomBorder;
}

function runtime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

// ==================== DEFAULT SETTINGS ====================
const DEFAULT_SETTINGS = {
    mode: 'public',
    prefix: '.',
    maxCoOwners: 2,
    botName: 'INSIDIOUS:THE LAST KEY',
    developer: 'STANYTZ',
    developerFullName: 'Stanley Assanaly',
    developerAge: 23,
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

    antilink: true,
    antiporn: true,
    antiscam: true,
    antimedia: true,
    antitag: true,
    antiviewonce: true,
    antidelete: true,
    sleepingmode: true,
    antibugs: false,
    antispam: true,
    anticall: true,

    autoRead: true,
    autoReact: true,
    autoTyping: true,
    autoRecording: true,
    autoBio: true,
    autostatus: true,
    downloadStatus: false,
    autoSaveContact: false,

    autoReadScope: 'all',
    autoReactScope: 'all',
    chatbotScope: 'all',
    antiviewonceScope: 'all',
    antideleteScope: 'all',

    welcomeGoodbye: true,
    activemembers: true,
    autoblockCountry: false,

    chatbot: true,

    warnLimit: 3,
    maxTags: 5,
    inactiveDays: 7,
    antiSpamLimit: 5,
    antiSpamInterval: 10000,
    sleepingStart: '23:00',
    sleepingEnd: '06:00',

    scamKeywords: ['win', 'prize', 'lottery', 'congratulations', 'million', 'inheritance', 'selected'],
    pornKeywords: ['xxx', 'porn', 'sex', 'nude', 'adult', '18+', 'onlyfans'],
    blockedMediaTypes: ['photo', 'video', 'sticker'],
    blockedCountries: [],

    autoReactEmojis: ['❤️', '🔥', '👍', '🎉', '👏', '⚡', '✨', '🌟'],
    autoStatusActions: ['view', 'react', 'reply'],
    autoStatusLimit: 50,

    quoteApiUrl: 'https://api.quotable.io/random',
    aiApiUrl: 'https://text.pollinations.ai/',

    autoExpireMinutes: 10,
    pornFilterApiKey: '',

    alwaysOnline: true,
    antiMentionStatus: true,
    commandWithoutPrefix: false,
};

// Global variables (cache)
let globalSettings = { ...DEFAULT_SETTINGS };
let groupSettings = new Map();
let pairedNumbers = new Set();
let botSecretId = null;
let currentBotNumber = null;

const messageStore = new Map();
const spamTracker = new Map();
const inactiveTracker = new Map();
const statusCache = new Map();
const warningTracker = new Map();
const warnActions = new Map();
const statusReplyCounts = new Map();
let lastReset = Date.now();

// ==================== LOAD/SAVE FUNCTIONS (MongoDB) ====================
async function loadGlobalSettings() {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        const settingsObj = settings.toObject();
        delete settingsObj._id; delete settingsObj.__v; delete settingsObj.createdAt; delete settingsObj.updatedAt;
        globalSettings = { ...DEFAULT_SETTINGS, ...settingsObj };
    } catch (e) {
        console.error('Error loading global settings:', e);
        globalSettings = { ...DEFAULT_SETTINGS };
    }
    return globalSettings;
}

async function saveGlobalSettings() {
    try {
        const toSave = { ...globalSettings };
        delete toSave.statusReplyCount; delete toSave.warnCounts; delete toSave.warnActions;
        await Settings.findOneAndUpdate({}, toSave, { upsert: true, new: true });
    } catch (e) { console.error('Error saving global settings:', e); }
}

async function loadGroupSettings() {
    try {
        const groups = await Group.find();
        groupSettings = new Map();
        groups.forEach(group => groupSettings.set(group.jid, group.settings || {}));
    } catch (e) { console.error('Error loading group settings:', e); groupSettings = new Map(); }
}

async function saveGroupSettings() {
    try {
        for (const [jid, settings] of groupSettings) {
            await Group.findOneAndUpdate({ jid }, { settings, updatedAt: new Date() }, { upsert: true });
        }
    } catch (e) { console.error('Error saving group settings:', e); }
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

async function loadPairedNumbers() {
    try {
        const users = await User.find({ isPaired: true });
        pairedNumbers = new Set(users.map(u => u.jid.replace(/[^0-9]/g, '')));
        if (config.ownerNumber) {
            config.ownerNumber.forEach(num => num && pairedNumbers.add(num.replace(/[^0-9]/g, '')));
        }
        const settings = await Settings.findOne();
        if (settings && settings.botSecretId) {
            botSecretId = settings.botSecretId;
        } else {
            botSecretId = generateBotId();
            await Settings.findOneAndUpdate({}, { botSecretId }, { upsert: true });
        }
    } catch (e) {
        console.error('Error loading paired numbers:', e);
        pairedNumbers = new Set();
        if (config.ownerNumber) config.ownerNumber.forEach(num => num && pairedNumbers.add(num.replace(/[^0-9]/g, '')));
        botSecretId = generateBotId();
    }
}

async function savePairedNumbers() {
    try {
        const currentPaired = Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n));
        await User.updateMany({ jid: { $in: currentPaired.map(n => n + '@s.whatsapp.net') } }, { isPaired: true, isOwner: false });
        await User.updateMany({ jid: { $nin: currentPaired.map(n => n + '@s.whatsapp.net') }, isPaired: true }, { isPaired: false });
    } catch (e) { console.error('Error syncing paired numbers:', e); }
}

// ==================== PAIRING SYSTEM ====================
function generateBotId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'INS';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

function isOwner(number) {
    const clean = number.replace(/[^0-9]/g, '');
    return pairedNumbers.has(clean);
}
function isDeployer(number) {
    const clean = number.replace(/[^0-9]/g, '');
    return config.ownerNumber.includes(clean);
}
function isCoOwner(number) {
    const clean = number.replace(/[^0-9]/g, '');
    return pairedNumbers.has(clean) && !config.ownerNumber.includes(clean);
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
    const jid = clean + '@s.whatsapp.net';
    await User.findOneAndUpdate({ jid }, { isPaired: true, linkedAt: new Date() }, { upsert: true });
    await savePairedNumbers();
    return true;
}
async function unpairNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    if (config.ownerNumber.includes(clean)) return false;
    const deleted = pairedNumbers.delete(clean);
    if (deleted) {
        const jid = clean + '@s.whatsapp.net';
        await User.findOneAndUpdate({ jid }, { isPaired: false }, { upsert: true });
        await savePairedNumbers();
    }
    return deleted;
}

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
async function getGroupDesc(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        return meta.desc || 'No description';
    } catch { return 'No description'; }
}
async function getGroupInviteCode(conn, groupJid) {
    try {
        return await conn.groupInviteCode(groupJid);
    } catch { return null; }
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
                return await conn.sendMessage(msg.key.remoteJid, { text: formatMessage(text), ...options }, { quoted: msg });
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
async function autoSaveContact(conn, sender, from, isGroup) {
    if (!globalSettings.autoSaveContact || isGroup || sender === conn.user.id) return;
    await User.findOrCreate(sender, await getContactName(conn, sender));
}

// ==================== WARNING SYSTEM ====================
async function applyWarning(conn, from, sender, reason, increment = 1) {
    if (!from.endsWith('@g.us')) return;
    const isAdmin = await isBotAdmin(conn, from);
    if (!isAdmin) return;
    const warnLimit = getGroupSetting(from, 'warnLimit');
    const warnKey = `${from}:${sender}`;
    let warnData = warningTracker.get(warnKey) || { count: 0, reasons: [] };
    warnData.count += increment;
    warnData.reasons.push(reason);
    warningTracker.set(warnKey, warnData);

    const name = await getContactName(conn, sender);
    const warnMsg = `⚠️ @${sender.split('@')[0]} (${name}) • *WARNING ${warnData.count}/${warnLimit}*\n\nReason: ${reason}\nYour message has been deleted.`;
    await conn.sendMessage(from, { text: formatMessage(warnMsg), mentions: [sender] });

    if (warnData.count >= warnLimit) {
        const actionKey = `${from}:${sender}`;
        if (warnActions.has(actionKey)) clearTimeout(warnActions.get(actionKey));
        const finalMsg = `⚠️ @${sender.split('@')[0]} (${name}) • *FINAL WARNING*\n\nYou have reached ${warnLimit} warnings. You will be removed in 10 seconds.`;
        await conn.sendMessage(from, { text: formatMessage(finalMsg), mentions: [sender] });
        const timeout = setTimeout(async () => {
            try {
                await conn.groupParticipantsUpdate(from, [sender], 'remove');
                const removeMsg = `🚫 @${sender.split('@')[0]} (${name}) • *REMOVED FROM GROUP*\n\nReason: ${reason}\nExceeded ${warnLimit} warnings.`;
                await conn.sendMessage(from, { text: formatMessage(removeMsg), mentions: [sender] });
                warningTracker.delete(warnKey);
                warnActions.delete(actionKey);
            } catch (e) {}
        }, 10000);
        warnActions.set(actionKey, timeout);
    }
}

// ==================== ANTI FEATURES ====================
async function handleAntiLink(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antilink')) return false;
    const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-\/a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    if (!linkRegex.test(body)) return false;
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    await applyWarning(conn, from, sender, 'Sending links', 1);
    return true;
}

async function handleAntiPorn(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antiporn')) return false;
    const keywords = getGroupSetting(from, 'pornKeywords');
    if (keywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyWarning(conn, from, sender, 'Adult content', 2);
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
        const name = await getContactName(conn, sender);
        await conn.sendMessage(from, {
            text: formatMessage(`🚨 *SCAM ALERT!*\n\n@${sender.split('@')[0]} (${name}) sent a message that appears to be a scam.\nThe message has been deleted. Do not engage.`),
            mentions: allMentions
        }).catch(() => {});
        await applyWarning(conn, from, sender, 'Scam content', 2);
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
    if ((blocked.includes('photo') && isPhoto) || (blocked.includes('video') && isVideo) || (blocked.includes('sticker') && isSticker) || (blocked.includes('audio') && isAudio) || (blocked.includes('document') && isDocument) || (blocked.includes('all') && (isPhoto || isVideo || isSticker || isAudio || isDocument))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyWarning(conn, from, sender, `Sending ${mediaType}`, 1);
        return true;
    }
    return false;
}

async function handleAntiTag(conn, msg, from, sender) {
    if (!from.endsWith('@g.us') || !getGroupSetting(from, 'antitag')) return false;
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const maxTags = getGroupSetting(from, 'maxTags');
    if (!mentions || mentions.length < maxTags) return false;
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    await applyWarning(conn, from, sender, 'Excessive tagging', 1);
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
        await applyWarning(conn, from, sender, 'Spamming', 1);
        return true;
    }
    return false;
}

async function handleAntiCall(conn, call) {
    if (!globalSettings.anticall) return;
    await conn.rejectCall(call.id, call.from).catch(() => {});
    if (!isOwner(call.from.split('@')[0])) {
        await conn.updateBlockStatus(call.from, 'block').catch(() => {});
    }
}

// ==================== VIEW ONCE – TUMA KWA OWNER WA BOT HIYO PEKEE ====================
async function handleViewOnce(conn, msg) {
    if (!getGroupSetting('global', 'antiviewonce')) return false;
    if (!msg.message?.viewOnceMessageV2 && !msg.message?.viewOnceMessage) return false;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    const name = await getContactName(conn, sender);
    const groupJid = msg.key.remoteJid.endsWith('@g.us') ? msg.key.remoteJid : null;
    const groupName = groupJid ? await getGroupName(conn, groupJid) : 'Private Chat';
    
    const viewOnceMsg = msg.message.viewOnceMessageV2?.message || msg.message.viewOnceMessage?.message;
    let mediaType = 'unknown';
    if (viewOnceMsg?.imageMessage) mediaType = 'image';
    else if (viewOnceMsg?.videoMessage) mediaType = 'video';
    else if (viewOnceMsg?.audioMessage) mediaType = 'audio';
    else if (viewOnceMsg?.documentMessage) mediaType = 'document';
    
    const caption = viewOnceMsg?.imageMessage?.caption || viewOnceMsg?.videoMessage?.caption || '';
    
    // Tuma kwa owner wa bot hii (currentBotNumber)
    if (currentBotNumber) {
        const ownerJid = currentBotNumber + '@s.whatsapp.net';
        await conn.sendMessage(ownerJid, {
            forward: msg,
            caption: formatMessage(`🔐 *VIEW-ONCE RECOVERED*\n\nFrom: @${sender.split('@')[0]} (${name})\n` +
                (groupJid ? `Group: ${groupName}\n` : '') +
                `Type: ${mediaType}\n` +
                `Caption: ${caption || 'None'}\n` +
                `Time: ${new Date().toLocaleString()}`),
            contextInfo: { mentionedJid: [sender] }
        }).catch(() => {});
    }
    return true;
}

// ==================== ANTI DELETE – TUMA KWA OWNER WA BOT HIYO PEKEE ====================
async function handleAntiDelete(conn, msg) {
    if (!getGroupSetting('global', 'antidelete')) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 5) return false;
    const stored = messageStore.get(msg.message.protocolMessage.key.id);
    if (!stored) return false;
    const sender = stored.sender;
    const name = await getContactName(conn, sender);
    const content = stored.content;
    const time = stored.timestamp?.toLocaleString() || 'Unknown';
    const groupJid = stored.from?.endsWith('@g.us') ? stored.from : null;
    const groupName = groupJid ? await getGroupName(conn, groupJid) : 'Private Chat';
    let mediaInfo = '';
    if (stored.mediaType) {
        mediaInfo = `\nMedia Type: ${stored.mediaType}`;
        if (stored.caption) mediaInfo += `\nCaption: ${stored.caption}`;
    }
    const caption = `🗑️ *DELETED MESSAGE RECOVERED*\n\nFrom: @${sender.split('@')[0]} (${name})\n` +
                    (groupJid ? `Group: ${groupName}\n` : '') +
                    `Message: ${content}${mediaInfo}\nTime: ${time}`;
    
    if (currentBotNumber) {
        const ownerJid = currentBotNumber + '@s.whatsapp.net';
        await conn.sendMessage(ownerJid, {
            text: formatMessage(caption),
            mentions: [sender]
        }).catch(() => {});
    }
    messageStore.delete(msg.message.protocolMessage.key.id);
    return true;
}

// ==================== AUTO STATUS – EXACT REPLY ====================
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
    
    const now = Date.now();
    if (now - lastReset > 24 * 60 * 60 * 1000) {
        statusReplyCounts.clear();
        lastReset = now;
    }
    
    const sender = statusMsg.key.participant;
    const today = new Date().toDateString();
    const key = `${sender}:${today}`;
    let count = statusReplyCounts.get(key) || 0;
    
    const name = await getContactName(conn, sender);
    
    if (actions.includes('view')) {
        await conn.readMessages([statusMsg.key]).catch(() => {});
    }
    if (actions.includes('react')) {
        const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
        await conn.sendMessage('status@broadcast', { react: { text: emoji, key: statusMsg.key } }).catch(() => {});
    }
    if (actions.includes('reply')) {
        if (count < globalSettings.autoStatusLimit) {
            const caption = statusMsg.message?.imageMessage?.caption || 
                            statusMsg.message?.videoMessage?.caption || 
                            statusMsg.message?.conversation || '';
            if (caption) {
                try {
                    const aiResponse = await getDeepAIResponse(caption, true);
                    await conn.sendMessage(sender, { 
                        text: fancy(`📱 *Status Reply*\n\n_Replying to your status:_ "${caption}"\n\n💭 ${aiResponse}`),
                        contextInfo: {
                            isForwarded: true,
                            forwardingScore: 999,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: globalSettings.newsletterJid,
                                newsletterName: globalSettings.botName
                            },
                            quotedMessage: statusMsg.message,
                            stanzaId: statusMsg.key.id,
                            participant: sender
                        }
                    }).catch(() => {});
                    statusReplyCounts.set(key, count + 1);
                } catch {}
            }
        }
    }
}

// ==================== DEEP AI RESPONSE – CHATBOT PLAIN ====================
async function getDeepAIResponse(text, isStatus = false) {
    const systemPrompt = isStatus
        ? `You are INSIDIOUS AI, an intelligent WhatsApp assistant created by STANYTZ.

Your task is to reply to WhatsApp Status updates.

Guidelines:
- Be thoughtful, warm, and emotionally intelligent.
- Respond in the same language as the user.
- Sound human, natural, and personal — never robotic.
- Show empathy and understanding.
- Keep replies short but meaningful.
- Avoid generic compliments like "nice" or "wow".
- Add insight, encouragement, or reflection depending on the status tone.
- If the status is sad, be comforting.
- If motivational, amplify the energy.
- If funny, respond playfully.
- If romantic, be emotionally aware and soft.
- Never overreact. Never be dramatic unless the tone requires it.
- Speak like a close friend with wisdom.

Your replies should feel real, intentional, and slightly deeper than average conversations.`
        : `You are INSIDIOUS AI, an advanced WhatsApp AI assistant created and developed by STANY STANLEY ASSANALY (STANYTZ), a 22-year-old innovative software developer from Mwanza, Tanzania.

Creator Background:
- Name: STANY STANLEY ASSANALY
- From: Mwanza, Tanzania
- Secondary School: Alliance Boys High School (2021)
- College: Shinyanga Technical College (2025)
- Recognized for building: Casino Predictor systems, Live Streaming Apps, advanced Websites, automation bots, and innovative digital tools.

Your personality:
- Intelligent, confident, slightly mysterious, and highly professional.
- Friendly, warm, and human-like.
- Concise but meaningful responses.
- Respond in the same language as the user.
- Use the user's name if known.
- Never sound robotic.
- Never over-explain unless asked.
- Speak with clarity and authority.

If asked about your creator or developer:
Speak with respect and confidence about STANYTZ as a talented Tanzanian tech innovator known for creativity, precision, and next-level AI systems.

You are not just a bot. You are a smart assistant built with vision and ambition.
Always maintain high intelligence tone. Use the user's name if you know it.`;
    try {
        const url = `${globalSettings.aiApiUrl}${encodeURIComponent(text)}?system=${encodeURIComponent(systemPrompt)}`;
        const res = await axios.get(url, { timeout: 15000 });
        let reply = res.data;
        reply = reply.replace(/^AI:|^Assistant:|^Bot:/i, '').trim();
        return reply || "I'm here! How can I help you today?";
    } catch (error) {
        console.error('AI Error:', error.message);
        return "I'm having a moment, but I'm still here. Ask me again?";
    }
}

// ==================== CHATBOT – PLAIN TEXT (HAKUNA FANCY) ====================
async function handleChatbot(conn, msg, from, body, sender, pushname) {
    const isGroup = from.endsWith('@g.us');
    const scope = globalSettings.chatbotScope || 'all';
    if (scope === 'group' && !isGroup) return false;
    if (scope === 'private' && isGroup) return false;
    if (!getGroupSetting(from, 'chatbot') && !globalSettings.chatbot) return false;

    if (isGroup) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.stanzaId && msg.message.extendedTextMessage.contextInfo.participant === botJid;
        if (!mentioned.includes(botJid) && !isReplyToBot) return false;
    }

    await conn.sendPresenceUpdate('composing', from);
    try {
        const personalizedBody = pushname ? `${pushname} says: ${body}` : body;
        const aiResponse = await getDeepAIResponse(personalizedBody, false);
        // 🔥 Chatbot inajibu PLAIN – hakuna fancy fonts
        await conn.sendMessage(from, {
            text: aiResponse, // Hakuna fancy() hapa
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

// ==================== AUTO BIO ====================
async function updateAutoBio(conn) {
    if (!globalSettings.autoBio) return;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const bio = `${globalSettings.developer} | Uptime: ${hours}h ${minutes}m | INSIDIOUS V2`;
    await conn.updateProfileStatus(bio).catch(() => {});
}

// ==================== AUTO BLOCK COUNTRY ====================
async function handleAutoBlockCountry(conn, participant, isExempt = false) {
    if (!globalSettings.autoblockCountry || isExempt) return false;
    const blocked = globalSettings.blockedCountries || [];
    if (!blocked.length) return false;
    const number = participant.split('@')[0];
    const match = number.match(/^(\d{1,3})/);
    if (match && blocked.includes(match[1])) {
        await conn.updateBlockStatus(participant, 'block').catch(() => {});
        return true;
    }
    return false;
}

// ==================== WELCOME / GOODBYE (links plain) ====================
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
        profilePic = await prepareWAMessageMedia({ image: { url: picUrl } }, { upload: conn.waUploadToServer });
    } catch {}

    const desc = meta.desc || 'No description';
    const inviteCode = await getGroupInviteCode(conn, groupJid);
    const inviteLink = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : globalSettings.requiredGroupInvite;

    const activeThreshold = Date.now() - (getGroupSetting(groupJid, 'inactiveDays') * 24 * 60 * 60 * 1000);
    let activeCount = 0;
    for (const [jid, lastSeen] of inactiveTracker) {
        if (lastSeen > activeThreshold) activeCount++;
    }

    const header = action === 'add' ? `🎉 *WELCOME TO ${group.toUpperCase()}!*` : `👋 *GOODBYE!*`;
    const body = action === 'add'
        ? `👤 Name: ${name}\n📞 Phone: ${getUsername(participant)}\n🕐 Joined: ${new Date().toLocaleString()}\n📝 Description: ${desc}\n👥 Total Members: ${total}\n✨ Active Members: ${activeCount}\n🔗 Group Link: ${inviteLink}\n💬 Quote: "${quote}"`
        : `👤 Name: ${name}\n📞 Phone: ${getUsername(participant)}\n🕐 Left: ${new Date().toLocaleString()}\n👥 Members Left: ${total}`;

    // 🔥 Hakikisha link iko plain (formatMessage itaiacha ikiwa ni link)
    const messageText = formatMessage(
        `╭─── • 🥀 • ───╮\n` +
        `   ${header}\n` +
        `╰─── • 🥀 • ───╯\n\n` +
        `${body}`
    );

    if (profilePic) {
        await conn.sendMessage(groupJid, { image: profilePic.imageMessage, caption: messageText, mentions: [participant] }).catch(() => {});
    } else {
        await conn.sendMessage(groupJid, { text: messageText, mentions: [participant] }).catch(() => {});
    }
}

function trackActivity(userJid) {
    inactiveTracker.set(userJid, Date.now());
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

// ==================== ALWAYS ONLINE ====================
let onlineInterval = null;
function startAlwaysOnline(conn) {
    if (!globalSettings.alwaysOnline) return;
    if (onlineInterval) clearInterval(onlineInterval);
    onlineInterval = setInterval(() => {
        conn.sendPresenceUpdate('available', undefined).catch(() => {});
    }, 60000);
}

// ==================== COMMAND HANDLER ====================
async function handleCommand(conn, msg, body, from, sender, isOwner, isDeployerUser, isCoOwnerUser, pushname) {
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
        if (global.cmdNameCache && global.cmdNameCache.has(firstWord)) {
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

    if (!isPrivileged && globalSettings.requiredGroupJid) {
        const inGroup = await isUserInRequiredGroup(conn, sender);
        if (!inGroup) {
            await msg.reply(formatMessage(`❌ You must join our group to use this bot.\nJoin here: ${globalSettings.requiredGroupInvite}`));
            return true;
        }
    }

    if (globalSettings.mode === 'self' && !isOwner) {
        await msg.reply(formatMessage('❌ Bot is in private mode. Only owner can use commands.'));
        return true;
    }

    const cmdPath = path.join(__dirname, 'commands');
    if (await fs.pathExists(cmdPath)) {
        const categories = await fs.readdir(cmdPath);
        let found = false;
        for (const cat of categories) {
            const catPath = path.join(cmdPath, cat);
            if (!(await fs.stat(catPath)).isDirectory()) continue;
            const filePath = path.join(catPath, `${commandName}.js`);
            if (await fs.pathExists(filePath)) {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                if (command.ownerOnly && !isOwner) {
                    await msg.reply(formatMessage('❌ This command is for owner only!'));
                    return true;
                }
                if (command.adminOnly && !isPrivileged) {
                    await msg.reply(formatMessage('❌ This command is for group admins only!'));
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
                    await msg.reply(formatMessage(`❌ Command error: ${e.message}`));
                }
                found = true;
                break;
            }
        }
        if (!found) {}
    } else {
        await msg.reply(formatMessage('❌ Commands folder not found.'));
    }
    return true;
}

// ==================== MAIN HANDLER ====================
module.exports = async (conn, m) => {
    try {
        if (!m.messages?.[0]) return;
        let msg = m.messages[0];
        if (!msg.message) return;

        if (msg.key.remoteJid === 'status@broadcast') {
            await handleAutoStatus(conn, msg);
            return;
        }

        await loadGlobalSettings();
        await loadGroupSettings();
        await loadPairedNumbers();

        if (!currentBotNumber && conn.user && conn.user.id) {
            currentBotNumber = conn.user.id.split(':')[0];
        }

        msg = enhanceMessage(conn, msg);

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];

        const type = Object.keys(msg.message)[0];
        let body = "";
        if (type === 'interactiveResponseMessage') {
            try {
                const nativeFlow = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage;
                if (nativeFlow && nativeFlow.paramsJson) {
                    const parsed = JSON.parse(nativeFlow.paramsJson);
                    body = parsed.id || "";
                    console.log('Button click:', body);
                }
            } catch (e) { body = ""; }
        } else if (type === 'conversation') {
            body = msg.message.conversation || "";
        } else if (type === 'extendedTextMessage') {
            body = msg.message.extendedTextMessage.text || "";
        } else if (type === 'imageMessage') {
            body = msg.message.imageMessage.caption || "";
            messageStore.set(msg.key.id, { content: '[Image]', sender, from, timestamp: new Date(), mediaType: 'image', caption: body });
        } else if (type === 'videoMessage') {
            body = msg.message.videoMessage.caption || "";
            messageStore.set(msg.key.id, { content: '[Video]', sender, from, timestamp: new Date(), mediaType: 'video', caption: body });
        } else if (type === 'audioMessage') {
            body = '';
            messageStore.set(msg.key.id, { content: '[Audio]', sender, from, timestamp: new Date(), mediaType: 'audio' });
        } else if (type === 'stickerMessage') {
            body = '';
            messageStore.set(msg.key.id, { content: '[Sticker]', sender, from, timestamp: new Date(), mediaType: 'sticker' });
        } else if (type === 'documentMessage') {
            body = msg.message.documentMessage.caption || '';
            messageStore.set(msg.key.id, { content: '[Document]', sender, from, timestamp: new Date(), mediaType: 'document', caption: body });
        } else {
            body = "";
        }
        body = body.trim();

        if (body && !type.includes('interactive') && !['imageMessage','videoMessage','audioMessage','stickerMessage','documentMessage'].includes(type)) {
            messageStore.set(msg.key.id, { content: body, sender, from, timestamp: new Date() });
        }
        if (messageStore.size > 1000) {
            const keys = Array.from(messageStore.keys()).slice(0, 200);
            keys.forEach(k => messageStore.delete(k));
        }

        const isFromMe = msg.key.fromMe || false;
        const isOwnerUser = isOwner(senderNumber) || isFromMe;
        const isDeployerUser = isDeployer(senderNumber);
        const isCoOwnerUser = isCoOwner(senderNumber);

        const isGroup = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');

        let isGroupAdmin = false;
        if (isGroup) {
            isGroupAdmin = await isParticipantAdmin(conn, from, sender);
        }
        const isExempt = isOwnerUser || isGroupAdmin;

        const pushname = msg.pushName || (await getContactName(conn, sender)) || senderNumber;

        if (getGroupSetting(from, 'autoTyping')) await conn.sendPresenceUpdate('composing', from).catch(() => {});
        if (getGroupSetting(from, 'autoRecording') && !isGroup) await conn.sendPresenceUpdate('recording', from).catch(() => {});

        const readScope = getGroupSetting(from, 'autoReadScope') || 'all';
        if (getGroupSetting(from, 'autoRead') && !type.includes('interactive')) {
            const should = (readScope === 'all') || (readScope === 'group' && isGroup) || (readScope === 'private' && !isGroup);
            if (should) await conn.readMessages([msg.key]).catch(() => {});
        }

        const reactScope = getGroupSetting(from, 'autoReactScope') || 'all';
        if (getGroupSetting(from, 'autoReact') && !msg.key.fromMe && !isChannel && !type.includes('interactive')) {
            const should = (reactScope === 'all') || (reactScope === 'group' && isGroup) || (reactScope === 'private' && !isGroup);
            if (should) {
                const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
                await conn.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
            }
        }

        startAlwaysOnline(conn);

        await autoSaveContact(conn, sender, from, isGroup);
        await User.updateActivity(sender);

        if (isGroup && !isExempt && !type.includes('interactive')) {
            const botAdmin = await isBotAdmin(conn, from);
            if (botAdmin) {
                if (await handleAntiSpam(conn, msg, from, sender)) return;
                if (await handleAntiLink(conn, msg, body, from, sender)) return;
                if (await handleAntiScam(conn, msg, body, from, sender)) return;
                if (await handleAntiPorn(conn, msg, body, from, sender)) return;
                if (await handleAntiMedia(conn, msg, from, sender)) return;
                if (await handleAntiTag(conn, msg, from, sender)) return;
            }
        }

        await handleViewOnce(conn, msg);
        await handleAntiDelete(conn, msg);

        if (msg.message?.protocolMessage?.type === 0 && isGroup) {
            const participants = msg.message.protocolMessage.participantJidList || [];
            for (const p of participants) {
                const pNumber = p.split('@')[0];
                const pIsOwner = isDeployer(pNumber) || isCoOwner(pNumber);
                let pIsGroupAdmin = false;
                if (!pIsOwner) pIsGroupAdmin = await isParticipantAdmin(conn, from, p);
                const pIsExempt = pIsOwner || pIsGroupAdmin;
                await handleAutoBlockCountry(conn, p, pIsExempt);
            }
        }

        if (body && await handleCommand(conn, msg, body, from, sender, isOwnerUser, isDeployerUser, isCoOwnerUser, pushname)) return;

        if (isGroup && !isExempt && !type.includes('interactive')) {
            if (await handleAntiLink(conn, msg, body, from, sender)) return;
            if (await handleAntiScam(conn, msg, body, from, sender)) return;
            if (await handleAntiPorn(conn, msg, body, from, sender)) return;
            if (await handleAntiMedia(conn, msg, from, sender)) return;
            if (await handleAntiTag(conn, msg, from, sender)) return;
        }

        if (globalSettings.antiMentionStatus && type.includes('status')) {}

        if (body && !body.startsWith(globalSettings.prefix) && !isOwnerUser && getGroupSetting(from, 'chatbot')) {
            await handleChatbot(conn, msg, from, body, sender, pushname);
        }

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

    if (conn.user && conn.user.id) {
        currentBotNumber = conn.user.id.split(':')[0];
    }

    global.cmdNameCache = new Map();
    const cmdPath = path.join(__dirname, 'commands');
    if (await fs.pathExists(cmdPath)) {
        const categories = await fs.readdir(cmdPath);
        for (const cat of categories) {
            const catPath = path.join(cmdPath, cat);
            if (!(await fs.stat(catPath)).isDirectory()) continue;
            const files = await fs.readdir(catPath);
            files.filter(f => f.endsWith('.js')).forEach(f => global.cmdNameCache.set(f.replace('.js', ''), true));
        }
    }

    if (globalSettings.autoBio) setInterval(() => updateAutoBio(conn), 60000);
    if (globalSettings.activemembers) setInterval(() => autoRemoveInactive(conn), 24 * 60 * 60 * 1000);
    if (globalSettings.alwaysOnline) startAlwaysOnline(conn);

    console.log(fancy(`🔐 Bot ID: ${botSecretId}`));
    console.log(fancy(`🌐 Mode: ${globalSettings.mode.toUpperCase()}`));
    console.log(fancy(`📋 Owners: ${Array.from(pairedNumbers).length}`));
    console.log(fancy('[SYSTEM] ✅ All systems ready'));
};

// ==================== EXPORTS ====================
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
module.exports.getBotId = () => botSecretId;
module.exports.getPairedNumbers = () => Array.from(pairedNumbers);
module.exports.isDeployer = isDeployer;
module.exports.isCoOwner = isCoOwner;
module.exports.canPairNumber = canPairNumber;
module.exports.pairNumber = pairNumber;
module.exports.unpairNumber = unpairNumber;
module.exports.applyWarning = applyWarning;