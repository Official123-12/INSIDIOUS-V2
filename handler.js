const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const config = require('./config');

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

function formatMessage(text) {
    if (!text) return text;
    const topBorder = '╭─── • 🥀 • ───╮\n';
    return topBorder + fancy(text);
}

function runtime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

// ==================== DEFAULT SETTINGS ====================
const DEFAULT_SETTINGS = {
    ...config,
    autoStatusLimit: 10,
    autoReact: true,
    autoRead: true,
    alwaysOnline: true,
    autoDeleteMessages: false,
    autoDeleteTimeout: 600000, // 10 minutes
    statusReplyCount: new Map(),
    warnCounts: new Map(),
    warnActions: new Map(),
    antiCall: true,
    antiMentionStatus: true,
    commandWithoutPrefix: false,
    chatbotPrompt: `You are INSIDIOUS AI, created by STANYTZ (the developer). You are a helpful WhatsApp bot assistant. Respond in the same language as the user. Be friendly, warm, and human-like. Keep responses concise but meaningful. If someone asks who created you, say you were created by STANYTZ. If they ask about themselves, use their name if available and be personal.`,
};

const SETTINGS_FILE = path.join(__dirname, '.settings.json');
const GROUP_SETTINGS_FILE = path.join(__dirname, '.groupsettings.json');
const PAIR_FILE = path.join(__dirname, '.paired.json');

let globalSettings = { ...DEFAULT_SETTINGS };
let groupSettings = new Map();
let pairedNumbers = new Set();
let botSecretId = null;

const messageStore = new Map();
const spamTracker = new Map();
const inactiveTracker = new Map();
const statusCache = new Map();
const userContacts = new Map();

// ==================== LOAD/SAVE FUNCTIONS ====================
async function loadGlobalSettings() {
    try {
        if (await fs.pathExists(SETTINGS_FILE)) {
            const saved = await fs.readJson(SETTINGS_FILE);
            globalSettings = { ...DEFAULT_SETTINGS, ...saved };
            globalSettings.statusReplyCount = new Map();
            globalSettings.warnCounts = new Map();
            globalSettings.warnActions = new Map();
        }
    } catch (e) { console.error('Error loading global settings:', e); }
    return globalSettings;
}

async function saveGlobalSettings() {
    try {
        const toSave = { ...globalSettings };
        delete toSave.statusReplyCount;
        delete toSave.warnCounts;
        delete toSave.warnActions;
        await fs.writeJson(SETTINGS_FILE, toSave, { spaces: 2 });
    } catch (e) { console.error('Error saving global settings:', e); }
}

async function loadGroupSettings() {
    try {
        if (await fs.pathExists(GROUP_SETTINGS_FILE)) {
            const saved = await fs.readJson(GROUP_SETTINGS_FILE);
            groupSettings = new Map(Object.entries(saved));
        }
    } catch (e) { console.error('Error loading group settings:', e); }
}

async function saveGroupSettings() {
    try {
        const obj = Object.fromEntries(groupSettings);
        await fs.writeJson(GROUP_SETTINGS_FILE, obj, { spaces: 2 });
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

async function refreshConfig() {
    await loadGlobalSettings();
    await loadGroupSettings();
}

// ==================== PAIRING SYSTEM ====================
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
    if (config.ownerNumber) {
        config.ownerNumber.forEach(num => num && pairedNumbers.add(num.replace(/[^0-9]/g, '')));
    }
}

async function savePairedNumbers() {
    const data = {
        botId: botSecretId,
        paired: Array.from(pairedNumbers).filter(n => !config.ownerNumber?.includes(n))
    };
    await fs.writeJson(PAIR_FILE, data, { spaces: 2 });
}

function isOwner(number) {
    const clean = number.replace(/[^0-9]/g, '');
    return pairedNumbers.has(clean);
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

async function saveContact(conn, jid) {
    try {
        if (!userContacts.has(jid)) {
            const contact = await conn.getContact(jid);
            if (contact) {
                userContacts.set(jid, { name: contact.name || contact.pushname || jid.split('@')[0], jid });
            }
        }
    } catch (e) {}
}

// ==================== WARNING SYSTEM ====================
async function applyWarning(conn, from, sender, reason, increment = 1) {
    if (!from.endsWith('@g.us')) return;
    const botIsAdmin = await isBotAdmin(conn, from);
    if (!botIsAdmin) return;
    const warnLimit = getGroupSetting(from, 'warnLimit');
    const warnKey = `${from}:${sender}`;
    let warnData = globalSettings.warnCounts.get(warnKey) || { count: 0, reasons: [] };
    warnData.count += increment;
    warnData.reasons.push(reason);
    globalSettings.warnCounts.set(warnKey, warnData);

    const warnMsg = `⚠️ @${sender.split('@')[0]} • *WARNING ${warnData.count}/${warnLimit}*\n\nReason: ${reason}\nYour message has been deleted.`;
    await conn.sendMessage(from, { text: formatMessage(warnMsg), mentions: [sender] });

    if (warnData.count >= warnLimit) {
        const actionKey = `${from}:${sender}`;
        if (globalSettings.warnActions.has(actionKey)) {
            clearTimeout(globalSettings.warnActions.get(actionKey));
        }
        const finalMsg = `⚠️ @${sender.split('@')[0]} • *FINAL WARNING*\n\nYou have reached ${warnLimit} warnings. You will be removed in 10 seconds.`;
        await conn.sendMessage(from, { text: formatMessage(finalMsg), mentions: [sender] });
        const timeout = setTimeout(async () => {
            try {
                await conn.groupParticipantsUpdate(from, [sender], 'remove');
                const removeMsg = `🚫 @${sender.split('@')[0]} • *REMOVED FROM GROUP*\n\nReason: ${reason}\nExceeded ${warnLimit} warnings.`;
                await conn.sendMessage(from, { text: formatMessage(removeMsg), mentions: [sender] });
                globalSettings.warnCounts.delete(warnKey);
                globalSettings.warnActions.delete(actionKey);
            } catch (e) {}
        }, 10000);
        globalSettings.warnActions.set(actionKey, timeout);
    }
}

// ==================== ANTI FEATURES (Group Only) ====================
async function handleAntiLink(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us')) return false;
    if (!getGroupSetting(from, 'antilink')) return false;
    const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-\/a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    if (!linkRegex.test(body)) return false;
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    await applyWarning(conn, from, sender, 'Sending links', 1);
    return true;
}

async function handleAntiPorn(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us')) return false;
    if (!getGroupSetting(from, 'antiporn')) return false;
    const keywords = getGroupSetting(from, 'pornKeywords');
    if (keywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        await applyWarning(conn, from, sender, 'Adult content', 2);
        return true;
    }
    return false;
}

async function handleAntiScam(conn, msg, body, from, sender) {
    if (!from.endsWith('@g.us')) return false;
    if (!getGroupSetting(from, 'antiscam')) return false;
    const keywords = getGroupSetting(from, 'scamKeywords');
    if (keywords.some(w => body.toLowerCase().includes(w))) {
        await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
        const meta = await conn.groupMetadata(from);
        const allMentions = meta.participants.map(p => p.id);
        await conn.sendMessage(from, {
            text: formatMessage(`🚨 *SCAM ALERT!*\n\n@${sender.split('@')[0]} sent a message that appears to be a scam.\nThe message has been deleted. Do not engage.`),
            mentions: allMentions
        }).catch(() => {});
        await applyWarning(conn, from, sender, 'Scam content', 2);
        return true;
    }
    return false;
}

async function handleAntiMedia(conn, msg, from, sender) {
    if (!from.endsWith('@g.us')) return false;
    if (!getGroupSetting(from, 'antimedia')) return false;
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
        await applyWarning(conn, from, sender, `Sending ${mediaType}`, 1);
        return true;
    }
    return false;
}

async function handleAntiTag(conn, msg, from, sender) {
    if (!from.endsWith('@g.us')) return false;
    if (!getGroupSetting(from, 'antitag')) return false;
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const maxTags = getGroupSetting(from, 'maxTags');
    if (!mentions || mentions.length < maxTags) return false;
    await conn.sendMessage(from, { delete: msg.key }).catch(() => {});
    await applyWarning(conn, from, sender, 'Excessive tagging', 1);
    return true;
}

async function handleAntiSpam(conn, msg, from, sender) {
    if (!from.endsWith('@g.us')) return false;
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

// ==================== ANTI CALL ====================
async function handleAntiCall(conn, call) {
    if (!globalSettings.antiCall) return;
    await conn.rejectCall(call.id, call.from).catch(() => {});
    if (!isOwner(call.from.split('@')[0])) {
        await conn.updateBlockStatus(call.from, 'block').catch(() => {});
    }
}

// ==================== ANTI MENTION STATUS ====================
async function handleAntiMentionStatus(conn, statusMsg) {
    // Not fully implemented – could ignore mentions in status
}

// ==================== VIEW ONCE – Send to all owners ====================
async function handleViewOnce(conn, msg) {
    if (!getGroupSetting('global', 'antiviewonce')) return false;
    if (!msg.message?.viewOnceMessageV2 && !msg.message?.viewOnceMessage) return false;
    const sender = msg.key.participant || msg.key.remoteJid;
    const name = await getContactName(conn, sender);
    const time = new Date().toLocaleString();
    const groupJid = msg.key.remoteJid.endsWith('@g.us') ? msg.key.remoteJid : null;
    const groupName = groupJid ? await getGroupName(conn, groupJid) : 'Private Chat';

    let caption = `🔐 *VIEW-ONCE RECOVERED*\n\nFrom: @${sender.split('@')[0]} (${name})\n`;
    if (groupJid) caption += `Group: ${groupName}\n`;
    caption += `Time: ${time}`;

    for (const num of Array.from(pairedNumbers)) {
        const ownerJid = num + '@s.whatsapp.net';
        try {
            const sentMsg = await conn.sendMessage(ownerJid, {
                forward: msg,
                caption: formatMessage(caption),
                contextInfo: { mentionedJid: [sender] }
            });
            if (globalSettings.autoDeleteMessages && sentMsg) {
                setTimeout(async () => {
                    try { await conn.sendMessage(ownerJid, { delete: sentMsg.key }); } catch (e) {}
                }, globalSettings.autoDeleteTimeout);
            }
        } catch (e) {}
    }
    return true;
}

// ==================== ANTI DELETE – Send to all owners ====================
async function handleAntiDelete(conn, msg) {
    if (!getGroupSetting('global', 'antidelete')) return false;
    if (!msg.message?.protocolMessage || msg.message.protocolMessage.type !== 0) return false;
    const deletedMsgId = msg.message.protocolMessage.key.id;
    const stored = messageStore.get(deletedMsgId);
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

    let caption = `🗑️ *DELETED MESSAGE RECOVERED*\n\nFrom: @${sender.split('@')[0]} (${name})\n`;
    if (groupJid) caption += `Group: ${groupName}\n`;
    caption += `Message: ${content}${mediaInfo}\nTime: ${time}`;

    for (const num of Array.from(pairedNumbers)) {
        const ownerJid = num + '@s.whatsapp.net';
        try {
            const sentMsg = await conn.sendMessage(ownerJid, {
                text: formatMessage(caption),
                mentions: [sender]
            });
            if (globalSettings.autoDeleteMessages && sentMsg) {
                setTimeout(async () => {
                    try { await conn.sendMessage(ownerJid, { delete: sentMsg.key }); } catch (e) {}
                }, globalSettings.autoDeleteTimeout);
            }
        } catch (e) {}
    }
    messageStore.delete(deletedMsgId);
    return true;
}

// ==================== AUTO STATUS ====================
async function handleAutoStatus(conn, statusMsg) {
    if (!globalSettings.autostatus) return;
    if (statusMsg.key.remoteJid !== 'status@broadcast') return;
    const actions = globalSettings.autoStatusActions;
    const statusId = statusMsg.key.id;
    const statusSender = statusMsg.key.participant;
    if (statusCache.has(statusId)) return;
    statusCache.set(statusId, true);

    if (actions.includes('view')) await conn.readMessages([statusMsg.key]).catch(() => {});
    if (actions.includes('react')) {
        const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
        await conn.sendMessage('status@broadcast', { react: { text: emoji, key: statusMsg.key } }).catch(() => {});
    }
    if (actions.includes('reply')) {
        const today = new Date().toDateString();
        const key = `${statusSender}:${today}`;
        const count = globalSettings.statusReplyCount.get(key) || 0;
        if (count >= globalSettings.autoStatusLimit) return;
        const caption = statusMsg.message?.imageMessage?.caption || 
                        statusMsg.message?.videoMessage?.caption || 
                        statusMsg.message?.conversation || '';
        if (caption) {
            const aiResponse = await getDeepAIResponse(caption, true, '');
            const replyText = `📱 *Status Reply*\n\n_Replying to your status:_ "${caption}"\n\n💭 ${aiResponse}`;
            const sentMsg = await conn.sendMessage(statusSender, {
                text: fancy(replyText),
                contextInfo: {
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: globalSettings.newsletterJid,
                        newsletterName: globalSettings.botName
                    },
                    quotedMessage: statusMsg.message,
                    stanzaId: statusMsg.key.id,
                    participant: statusSender
                }
            }).catch(() => {});
            if (sentMsg && globalSettings.autoDeleteMessages) {
                setTimeout(async () => {
                    try { await conn.sendMessage(statusSender, { delete: sentMsg.key }); } catch (e) {}
                }, globalSettings.autoDeleteTimeout);
            }
            globalSettings.statusReplyCount.set(key, count + 1);
        }
    }
}

cron.schedule('0 0 * * *', () => globalSettings.statusReplyCount.clear());

// ==================== DEEP AI RESPONSE (Human-like) ====================
async function getDeepAIResponse(text, isStatus = false, pushname = '') {
    try {
        const systemPrompt = isStatus
            ? `You are INSIDIOUS AI replying to a WhatsApp status. Be thoughtful, warm, and insightful. Match the user's language.`
            : globalSettings.chatbotPrompt || `You are INSIDIOUS AI, created by STANYTZ. Respond in the user's language. Be friendly and personal.`;
        const userContext = pushname ? `The user's name is ${pushname}. ` : '';
        const fullPrompt = userContext + systemPrompt;
        const response = await axios.get(
            `${globalSettings.aiApiUrl}${encodeURIComponent(text)}?system=${encodeURIComponent(fullPrompt)}`,
            { timeout: 20000 }
        );
        let reply = response.data;
        reply = reply.replace(/^AI:|^Assistant:|^Bot:/i, '').trim();
        return reply || "That's interesting!";
    } catch (e) {
        console.error('AI Error:', e);
        return "I'm here! How can I help?";
    }
}

// ==================== CHATBOT (with scope) ====================
async function handleChatbot(conn, msg, from, body, sender, isOwner, pushname) {
    const isGroup = from.endsWith('@g.us');
    const scope = globalSettings.chatbotScope || 'all';
    if (scope === 'group' && !isGroup) return false;
    if (scope === 'private' && isGroup) return false;
    if (!globalSettings.chatbot) return false;

    if (isGroup) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.stanzaId &&
                             msg.message.extendedTextMessage.contextInfo.participant === botJid;
        if (!mentioned.includes(botJid) && !isReplyToBot) return false;
    }

    await conn.sendPresenceUpdate('composing', from);
    const aiResponse = await getDeepAIResponse(body, false, pushname);
    const sentMsg = await conn.sendMessage(from, {
        text: fancy(aiResponse),
        contextInfo: {
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: globalSettings.newsletterJid,
                newsletterName: globalSettings.botName
            }
        }
    }, { quoted: msg }).catch(() => {});
    if (sentMsg && globalSettings.autoDeleteMessages) {
        setTimeout(async () => {
            try { await conn.sendMessage(from, { delete: sentMsg.key }); } catch (e) {}
        }, globalSettings.autoDeleteTimeout);
    }
    return true;
}

// ==================== WELCOME / GOODBYE ====================
async function handleWelcome(conn, participant, groupJid, action = 'add') {
    if (!getGroupSetting(groupJid, 'welcomeGoodbye')) return;
    try {
        const groupMeta = await conn.groupMetadata(groupJid);
        const groupName = groupMeta.subject || 'Group';
        const groupDesc = groupMeta.desc || 'No description';
        const inviteCode = await getGroupInviteCode(conn, groupJid);
        const groupLink = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : 'Unavailable';
        const memberName = await getContactName(conn, participant);
        const memberNumber = participant.split('@')[0];
        const memberPic = await conn.profilePictureUrl(participant, 'image').catch(() => null);
        const total = groupMeta.participants.length;
        const now = Date.now();
        let activeCount = 0;
        for (const p of groupMeta.participants) {
            const lastActive = inactiveTracker.get(p.id) || 0;
            if (now - lastActive < globalSettings.inactiveDays * 24 * 60 * 60 * 1000) activeCount++;
        }
        const time = new Date().toLocaleString();
        let quote = '';
        try {
            const res = await axios.get(globalSettings.quoteApiUrl);
            quote = res.data.content;
        } catch { quote = action === 'add' ? 'Welcome!' : 'Goodbye!'; }

        let caption = action === 'add'
            ? `📨 *NEW MEMBER JOINED*\n\nGroup: ${groupName}\nDescription: ${groupDesc}\nMember: @${memberNumber} (${memberName})\nNumber: ${memberNumber}\nTotal Members: ${total}\nActive Members: ${activeCount}\nGroup Link: ${groupLink}\nTime: ${time}\n\n💬 Quote: "${quote}"`
            : `👋 *MEMBER LEFT*\n\nGroup: ${groupName}\nMember: @${memberNumber} (${memberName})\nNumber: ${memberNumber}\nRemaining Members: ${total}\nTime: ${time}\n\n💬 Quote: "${quote}"`;

        caption = formatMessage(caption);

        // Send to group with member pic
        let imageMedia = null;
        if (memberPic) {
            try {
                imageMedia = await prepareWAMessageMedia({ image: { url: memberPic } }, { upload: conn.waUploadToServer || conn.upload });
            } catch (e) {}
        }
        const interactiveMsg = {
            body: { text: caption },
            footer: { text: fancy(globalSettings.footer) },
            header: imageMedia ? { imageMessage: imageMedia.imageMessage } : { title: fancy(action === 'add' ? 'WELCOME' : 'GOODBYE') },
        };
        const waMsg = generateWAMessageFromContent(groupJid, { interactiveMessage: interactiveMsg }, {
            userJid: conn.user.id,
            upload: conn.waUploadToServer || conn.upload
        });
        await conn.relayMessage(groupJid, waMsg.message, { messageId: waMsg.key.id });

        // DM to owners
        if (action === 'add') {
            for (const num of Array.from(pairedNumbers)) {
                const ownerJid = num + '@s.whatsapp.net';
                let ownerMsg = `📨 *NEW MEMBER JOINED*\n\nGroup: ${groupName}\nDescription: ${groupDesc}\nMember: @${memberNumber} (${memberName})\nNumber: ${memberNumber}\nTotal Members: ${total}\nActive Members: ${activeCount}\nGroup Link: ${groupLink}\nTime: ${time}`;
                ownerMsg = formatMessage(ownerMsg);
                const sentMsg = await conn.sendMessage(ownerJid, {
                    text: ownerMsg,
                    mentions: [participant],
                    contextInfo: { isForwarded: true }
                }).catch(() => {});
                if (sentMsg && globalSettings.autoDeleteMessages) {
                    setTimeout(async () => {
                        try { await conn.sendMessage(ownerJid, { delete: sentMsg.key }); } catch (e) {}
                    }, globalSettings.autoDeleteTimeout);
                }
            }
        }
    } catch (e) { console.error('Welcome error:', e); }
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
            if (now - lastActive > inactiveDays * 24 * 60 * 60 * 1000) toRemove.push(p.id);
        }
        if (toRemove.length) {
            await conn.groupParticipantsUpdate(jid, toRemove, 'remove').catch(() => {});
            const msg = `🧹 *Inactive Members Removed*\n\nRemoved ${toRemove.length} inactive members (${inactiveDays} days without activity).`;
            await conn.sendMessage(jid, { text: formatMessage(msg) });
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
    const match = number.match(/^(\d{1,3})/);
    if (match && blocked.includes(match[1])) {
        await conn.updateBlockStatus(participant, 'block').catch(() => {});
        return true;
    }
    return false;
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
async function handleCommand(conn, msg, body, from, sender, isOwnerUser, pushname) {
    let prefix = globalSettings.prefix;
    if (!body.startsWith(prefix)) return false;
    const args = body.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    let isGroupAdmin = false;
    if (from.endsWith('@g.us')) {
        isGroupAdmin = await isParticipantAdmin(conn, from, sender);
    }
    const isPrivileged = isOwnerUser || isGroupAdmin;

    if (globalSettings.mode === 'self' && !isOwnerUser) {
        await msg.reply('❌ Bot is in private mode. Only owner can use commands.');
        return true;
    }

    const cmdPath = path.join(__dirname, 'commands');
    if (!await fs.pathExists(cmdPath)) {
        await msg.reply('❌ Commands folder not found.');
        return true;
    }
    const categories = await fs.readdir(cmdPath);
    let found = false;
    for (const cat of categories) {
        const catPath = path.join(cmdPath, cat);
        if (!(await fs.stat(catPath)).isDirectory()) continue;
        const filePath = path.join(catPath, `${cmd}.js`);
        if (await fs.pathExists(filePath)) {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.ownerOnly && !isOwnerUser) {
                await msg.reply('❌ This command is for owner only!');
                return true;
            }
            if (command.adminOnly && !isPrivileged) {
                await msg.reply('❌ This command is for group admins only!');
                return true;
            }
            try {
                await command.execute(conn, msg, args, {
                    from,
                    sender,
                    fancy,
                    config: globalSettings,
                    isOwner: isOwnerUser,
                    reply: msg.reply,
                    botId: botSecretId,
                    isBotAdmin: (jid) => isBotAdmin(conn, jid),
                    isParticipantAdmin: (jid, participant) => isParticipantAdmin(conn, jid, participant),
                    getGroupSetting: (key) => getGroupSetting(from, key),
                    setGroupSetting: (key, val) => setGroupSetting(from, key, val)
                });
            } catch (e) {
                console.error(`Command error (${cmd}):`, e);
                await msg.reply(`❌ Command error: ${e.message}`);
            }
            found = true;
            break;
        }
    }
    if (!found) {
        // Silent ignore – no "command not found"
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
            await handleAntiMentionStatus(conn, msg);
            await handleAutoStatus(conn, msg);
            return;
        }

        await loadGlobalSettings();
        await loadGroupSettings();

        msg = enhanceMessage(conn, msg);

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];

        const type = Object.keys(msg.message)[0];
        let body = "";

        // Button click handling
        if (type === 'interactiveResponseMessage') {
            try {
                const interactive = msg.message.interactiveResponseMessage;
                const nativeFlow = interactive?.nativeFlowResponseMessage;
                if (nativeFlow?.paramsJson) {
                    const parsed = JSON.parse(nativeFlow.paramsJson);
                    body = parsed.id || "";
                    console.log('🔘 Button clicked:', body);
                } else if (interactive?.body?.text) {
                    body = interactive.body.text;
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
        }

        body = body.trim();

        if (body && !type.includes('interactive') && !['imageMessage','videoMessage','audioMessage','stickerMessage','documentMessage'].includes(type)) {
            messageStore.set(msg.key.id, { content: body, sender, from, timestamp: new Date() });
        }
        if (messageStore.size > 1000) {
            const keys = Array.from(messageStore.keys()).slice(0, 200);
            keys.forEach(k => messageStore.delete(k));
        }

        await saveContact(conn, sender);

        const pushname = msg.pushName || (await getContactName(conn, sender)) || senderNumber;
        const isFromMe = msg.key.fromMe || false;
        const isOwnerUser = isOwner(senderNumber) || isFromMe;

        const isGroup = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');

        let isGroupAdmin = false;
        if (isGroup) isGroupAdmin = await isParticipantAdmin(conn, from, sender);
        const isExempt = isOwnerUser || isGroupAdmin;

        // Auto presence
        if (globalSettings.autoTyping) await conn.sendPresenceUpdate('composing', from).catch(() => {});
        if (globalSettings.autoRecording && !isGroup) await conn.sendPresenceUpdate('recording', from).catch(() => {});

        if (globalSettings.autoRead && !type.includes('interactive')) {
            await conn.readMessages([msg.key]).catch(() => {});
        }

        // Auto react with scope
        const reactScope = globalSettings.autoReactScope || 'all';
        if (globalSettings.autoReact && !msg.key.fromMe && !isChannel && !type.includes('interactive')) {
            const should = (reactScope === 'all') || (reactScope === 'group' && isGroup) || (reactScope === 'private' && !isGroup);
            if (should) {
                const emoji = globalSettings.autoReactEmojis[Math.floor(Math.random() * globalSettings.autoReactEmojis.length)];
                await conn.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
            }
        }

        startAlwaysOnline(conn);

        // Security features (group only, bot admin, enabled)
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

        if (body) {
            const handled = await handleCommand(conn, msg, body, from, sender, isOwnerUser, pushname);
            if (handled) return;
        }

        // Chatbot
        if (body && !body.startsWith(globalSettings.prefix) && !isOwnerUser && globalSettings.chatbot && !type.includes('interactive')) {
            await handleChatbot(conn, msg, from, body, sender, isOwnerUser, pushname);
        }

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
    for (const p of participants) {
        const pNum = p.split('@')[0];
        const pIsOwner = isOwner(pNum);
        await handleAutoBlockCountry(conn, p, pIsOwner);
        if (action === 'add' && getGroupSetting(id, 'welcomeGoodbye')) {
            await handleWelcome(conn, p, id, 'add');
        } else if (action === 'remove' && getGroupSetting(id, 'welcomeGoodbye')) {
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
    if (globalSettings.autoBio) setInterval(() => updateAutoBio(conn), 60000);
    if (globalSettings.activemembers) setInterval(() => autoRemoveInactive(conn), 24 * 60 * 60 * 1000);
    if (globalSettings.alwaysOnline) startAlwaysOnline(conn);
    console.log(fancy(`🔐 Bot ID: ${botSecretId}`));
    console.log(fancy(`🌐 Mode: ${globalSettings.mode.toUpperCase()}`));
    console.log(fancy(`📋 Owners: ${Array.from(pairedNumbers).length}`));

    for (const num of Array.from(pairedNumbers)) {
        const ownerJid = num + '@s.whatsapp.net';
        try {
            const msg = `✅ *BOT ONLINE*\n\n🤖 Name: ${globalSettings.botName}\n📞 Number: ${conn.user.id.split(':')[0]}\n🔐 ID: ${botSecretId}\n🌐 Mode: ${globalSettings.mode.toUpperCase()}\n⚡ Status: ONLINE\n\n👑 Developer: ${globalSettings.developer}\n💾 Version: ${globalSettings.version}`;
            const sent = await conn.sendMessage(ownerJid, {
                image: { url: globalSettings.aliveImage },
                caption: formatMessage(msg),
                contextInfo: { isForwarded: true }
            });
            if (sent && globalSettings.autoDeleteMessages) {
                setTimeout(async () => {
                    try { await conn.sendMessage(ownerJid, { delete: sent.key }); } catch (e) {}
                }, globalSettings.autoDeleteTimeout);
            }
        } catch (e) {}
    }
    console.log(fancy('[SYSTEM] ✅ All systems ready'));
};

// ==================== EXPORTS ====================
module.exports.loadGlobalSettings = loadGlobalSettings;
module.exports.saveGlobalSettings = saveGlobalSettings;
module.exports.getGroupSetting = getGroupSetting;
module.exports.setGroupSetting = setGroupSetting;
module.exports.loadSettings = loadGlobalSettings;
module.exports.saveSettings = saveGlobalSettings;
module.exports.refreshConfig = refreshConfig;
module.exports.getBotId = () => botSecretId;
module.exports.getPairedNumbers = () => Array.from(pairedNumbers);
module.exports.applyWarning = applyWarning;
