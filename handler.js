const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');

// Normalize owner numbers
config.ownerNumber = (config.ownerNumber || [])
    .map(num => num.replace(/[^0-9]/g, ''))
    .filter(num => num.length >= 10);

// Fancy function
let fancy = (text) => text;
try {
    fancy = require('./lib/font').fancy;
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

// Storage
const messageStore = new Map();
const userActivity = new Map();
const warningTracker = new Map();

// =============== PAIRING SYSTEM (WHATSAPP ONLY) ===============
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
    return nonOwnerPaired.length < 2 && !pairedNumbers.has(clean);
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

// =============== HELPER FUNCTIONS ===============
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

// =============== AUTO FEATURES ===============
async function handleAutoTyping(conn, from, settings) {
    if (!settings?.autoTyping) return;
    try {
        await conn.sendPresenceUpdate('composing', from);
        setTimeout(async () => {
            await conn.sendPresenceUpdate('paused', from);
        }, 2000);
    } catch (e) {}
}

async function handleAutoRecording(conn, msg, settings) {
    if (!settings?.autoRecording) return;
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

// =============== ANTI DELETE STORAGE ===============
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

// =============== WELCOME/GOODBYE ===============
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

// =============== AUTO-FOLLOW CHANNELS ===============
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

// =============== WELCOME MESSAGE TO DEPLOYER ===============
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
🤖 *Name:* ${config.botName}
📞 *Number:* ${botNumber}
🔐 *Bot ID:* ${botSecretId}
👥 *Co‑owners:* ${Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n)).length}/2

⚡ *Status:* ONLINE & ACTIVE

📊 *ALL FEATURES ACTIVE:*
🛡️ Anti Link / Scam / Porn / Tag / Crash
🗑️ Anti Delete / ViewOnce
🤖 AI Chatbot (Pollinations)
📢 Auto‑Follow Channels
❤️ Auto‑React to Channel Posts
👀 Auto Read / Auto React
⚡ Auto Typing / Recording
🎉 Welcome/Goodbye

👑 *Deployer:* ${config.ownerName}
💾 *Version:* 2.1.1 | Year: 2025
`;
        await conn.sendMessage(jid, {
            image: { url: config.aliveImage || 'https://files.catbox.moe/insidious-alive.jpg' },
            caption: msg,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                    newsletterName: config.botName
                }
            }
        });
    } catch (e) {
        console.log(fancy('⚠️ Could not send welcome message'), e.message);
    }
}

// =============== INIT ===============
module.exports.init = async (conn) => {
    console.log(fancy('[SYSTEM] Initializing INSIDIOUS...'));
    await loadPairedNumbers();
    console.log(fancy(`🔐 Bot ID: ${botSecretId}`));
    console.log(fancy(`📋 Co‑owners: ${Array.from(pairedNumbers).filter(n => !config.ownerNumber.includes(n)).length}/2`));
    await autoFollowChannels(conn);
    await sendWelcomeToDeployer(conn);
    console.log(fancy('[SYSTEM] ✅ All systems ready'));
};

// =============== MAIN MESSAGE HANDLER ===============
module.exports = async (conn, m) => {
    try {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "");

        // OWNER DETECTION (FIXED)
        const isFromMe = msg.key.fromMe || false;
        const isDeployerUser = isDeployer(senderNumber);
        const isCoOwnerUser = isCoOwner(senderNumber);
        const isOwner = isFromMe || isDeployerUser || isCoOwnerUser;

        const isGroup = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');

        storeMessage(msg);
        await handleAutoTyping(conn, from, config);
        await handleAutoRecording(conn, msg, config);

        // 🔥 BLOCK CRASH ATTEMPTS
        if (body.length > 25000 && !isOwner) {
            await conn.sendMessage(from, { delete: msg.key });
            if (isGroup) await conn.groupParticipantsUpdate(from, [sender], "remove");
            await conn.updateBlockStatus(sender, "block");
            console.log(fancy(`🥀 BLOCKED CRASH ATTEMPT FROM: ${senderNumber}`));
            return;
        }

        // 📢 AUTO-REACT TO CHANNEL POSTS
        if (isChannel && !msg.key.fromMe) {
            const reactions = ['❤️', '🔥', '👍', '🎉', '👏', '⚡', '✨', '🌟'];
            const randomEmoji = reactions[Math.floor(Math.random() * reactions.length)];
            try {
                await conn.sendMessage(from, { react: { text: randomEmoji, key: msg.key } });
                console.log(fancy(`✅ Auto‑reacted ${randomEmoji} to channel post`));
            } catch (e) {}
        }

        // 👀 AUTO READ & ❤️ AUTO REACT
        if (config.autoRead) await conn.readMessages([msg.key]);
        if (config.autoReact && !msg.key.fromMe && !isChannel) {
            await conn.sendMessage(from, { react: { text: "🥀", key: msg.key } });
        }

        // 🛡️ GROUP SECURITY – ONLY NON-OWNERS
        if (isGroup && !isOwner) {
            if (config.antilink && body.match(/https?:\/\//gi)) {
                await conn.sendMessage(from, { delete: msg.key });
                await conn.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }
            if (config.antiscam && config.scamKeywords?.some(w => body.toLowerCase().includes(w))) {
                await conn.sendMessage(from, { delete: msg.key });
                const meta = await conn.groupMetadata(from);
                await conn.sendMessage(from, {
                    text: fancy(`⚠️ SCAM ALERT! @${senderNumber} is a scammer!`),
                    mentions: meta.participants.map(p => p.id)
                });
                await conn.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }
            if (config.antiporn && config.pornKeywords?.some(w => body.toLowerCase().includes(w))) {
                await conn.sendMessage(from, { delete: msg.key });
                await conn.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }
            if (config.antitag && msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 10) {
                await conn.sendMessage(from, { delete: msg.key });
                await conn.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }
        }

        // 🔁 ANTI DELETE & ANTI VIEWONCE
        if (msg.message.viewOnceMessageV2 || msg.message.protocolMessage) {
            for (const ownerNum of config.ownerNumber) {
                const jid = ownerNum + '@s.whatsapp.net';
                await conn.sendMessage(jid, {
                    forward: msg,
                    caption: fancy('ɪɴꜱɪᴅɪᴏᴜꜱ ʀᴇᴄᴏᴠᴇʀʏ ꜱʏꜱᴛᴇᴍ')
                });
            }
        }

        // 🤖 AI CHATBOT – PRIVATE CHAT ONLY
        if (!body.startsWith(config.prefix) && !msg.key.fromMe && !isGroup) {
            await conn.sendPresenceUpdate('composing', from);
            try {
                const ai = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(body)}?system=You are INSIDIOUS V2. Reply humanly in user language.`);
                return conn.sendMessage(from, {
                    text: fancy(ai.data),
                    contextInfo: {
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.newsletterJid || '120363404317544295@newsletter',
                            newsletterName: config.botName
                        }
                    }
                }, { quoted: msg });
            } catch (e) {}
        }

        // 📁 COMMAND HANDLER – ORIGINAL FORMAT
        if (body.startsWith(config.prefix)) {
            const command = body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const categories = fs.readdirSync('./commands');

            for (const cat of categories) {
                const cmdPath = `./commands/${cat}/${command}.js`;
                if (await fs.pathExists(cmdPath)) {
                    const cmd = require(cmdPath);
                    return cmd.execute(conn, msg, args, {
                        from,
                        sender,
                        fancy,
                        config,
                        isDeployer: isDeployerUser,
                        isCoOwner: isCoOwnerUser,
                        isOwner,
                        botId: botSecretId,
                        canPairNumber,
                        pairNumber,
                        unpairNumber,
                        getPairedNumbers,
                        reply: async (text, options = {}) => {
                            return await conn.sendMessage(from, { text, ...options }, { quoted: msg });
                        }
                    });
                }
            }
            await conn.sendMessage(from, { text: fancy(`❌ Command "${command}" not found`) }, { quoted: msg });
        }

    } catch (err) {
        console.error(fancy('❌ Handler Error:'), err.message);
    }
};

// =============== GROUP UPDATE HANDLER ===============
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

// =============== EXPORT UTILITIES ===============
module.exports.pairNumber = pairNumber;
module.exports.unpairNumber = unpairNumber;
module.exports.getPairedNumbers = getPairedNumbers;
module.exports.getBotId = () => botSecretId;
module.exports.isDeployer = isDeployer;
module.exports.isCoOwner = isCoOwner;
module.exports.canPairNumber = canPairNumber;
