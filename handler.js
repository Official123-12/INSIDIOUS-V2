const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber } = require('./database/models');

module.exports = async (conn, m) => {
    try {
        if (!m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "Unknown Soul";
        
        const body = (type === 'conversation') ? msg.message.conversation : 
                    (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : 
                    (type === 'imageMessage') ? msg.message.imageMessage.caption : 
                    (type === 'videoMessage') ? msg.message.videoMessage.caption : '';
        
        const isGroup = from.endsWith('@g.us');
        const isOwner = config.ownerNumber.includes(sender.split('@')[0]) || msg.key.fromMe;
        const prefix = config.prefix;
        const isCmd = body && body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body ? body.trim().split(/ +/).slice(1) : [];

        // SKIP CHANNEL MESSAGES
        if (from === config.newsletterJid) return;

        // AUTO READ
        if (config.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (error) {
                console.error("Auto read error:", error);
            }
        }

        // AUTO REACT
        if (config.autoReact && !msg.key.fromMe && !isGroup) {
            try {
                const reactions = ['🥀', '❤️', '🔥', '⭐', '✨'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                await conn.sendMessage(from, { 
                    react: { text: randomReaction, key: msg.key } 
                });
            } catch (error) {
                console.error("Auto react error:", error);
            }
        }

        // AUTO SAVE CONTACT
        if (config.autoSave && !isOwner && !isGroup) {
            try {
                let user = await User.findOne({ jid: sender });
                if (!user) {
                    user = new User({
                        jid: sender,
                        name: pushname,
                        lastActive: new Date(),
                        messageCount: 1
                    });
                } else {
                    user.messageCount += 1;
                    user.lastActive = new Date();
                }
                await user.save();
                
                console.log(fancy(`[SAVE] ${pushname} (${sender})`));
            } catch (error) {
                console.error("Auto save error:", error);
            }
        }

        // WORK MODE CHECK
        if (config.workMode === 'private' && !isOwner) return;

        // CHANNEL SUBSCRIPTION CHECK
        if (!isOwner && !isGroup) {
            const subscriber = await ChannelSubscriber.findOne({ 
                jid: sender, 
                isActive: true 
            });
            
            if (!subscriber) {
                // Auto subscribe
                await ChannelSubscriber.create({
                    jid: sender,
                    name: pushname,
                    subscribedAt: new Date(),
                    isActive: true,
                    autoFollow: true
                });
                
                // Send channel link
                await conn.sendMessage(from, { 
                    text: fancy(`╭── • 🥀 • ──╮\n  ${fancy("ᴄʜᴀɴɴᴇʟ ꜱᴜʙꜱᴄʀɪᴘᴛɪᴏɴ")}\n╰── • 🥀 • ──╯\n\n✅ Auto-subscribed to our channel!\n\n🔗 Stay updated: ${config.channelLink}\n\nYou can now use all bot features.`) 
                });
                
                console.log(fancy(`✅ Auto-subscribed ${sender} to channel`));
            } else {
                // Update last active
                subscriber.lastActive = new Date();
                await subscriber.save();
            }
        }

        // ANTI-BUG
        if (config.antibug && body) {
            const bugPatterns = ['\u200e', '\u200f', '\u202e', /[\u2066-\u2069]/g, /[^\x00-\x7F]/g];
            const hasBug = bugPatterns.some(pattern => {
                if (typeof pattern === 'string') {
                    return body.includes(pattern);
                } else if (pattern instanceof RegExp) {
                    return pattern.test(body);
                }
                return false;
            });
            
            if (hasBug) {
                try {
                    await conn.sendMessage(from, { 
                        delete: msg.key 
                    });
                    
                    await conn.sendMessage(from, { 
                        text: fancy(`🚫 ʙᴜɢ ᴅᴇᴛᴇᴄᴛᴇᴅ\n@${sender.split('@')[0]} sent malicious content\nAction: Message deleted & user warned`),
                        mentions: [sender]
                    });
                    
                    await conn.sendMessage(config.ownerNumber + '@s.whatsapp.net', { 
                        text: fancy(`⚠️ ʙᴜɢ ᴀᴛᴛᴇᴍᴘᴛ\nFrom: ${sender}\nContent: ${body.substring(0, 50)}...\nAction taken: Deleted & Warned`) 
                    });
                    
                    return;
                } catch (error) {
                    console.error("Antibug error:", error);
                }
            }
        }

        // ANTI-SPAM
        if (config.antispam && !isOwner) {
            try {
                let user = await User.findOne({ jid: sender });
                const now = Date.now();
                
                if (user) {
                    const timeDiff = now - (user.lastMessageTime || 0);
                    if (timeDiff < 60000) { // 1 minute
                        user.spamCount = (user.spamCount || 0) + 1;
                        
                        if (user.spamCount >= 5) {
                            if (isGroup) {
                                await conn.groupParticipantsUpdate(from, [sender], "remove");
                                await conn.sendMessage(from, { 
                                    text: fancy(`🚫 ꜱᴘᴀᴍᴍᴇʀ ʀᴇᴍᴏᴠᴇᴅ\n@${sender.split('@')[0]} has been removed for spamming`),
                                    mentions: [sender]
                                });
                            } else {
                                await conn.updateBlockStatus(sender, 'block');
                                await conn.sendMessage(from, { 
                                    text: fancy(`🚫 ʏᴏᴜ ʜᴀᴠᴇ ʙᴇᴇɴ ʙʟᴏᴄᴋᴇᴅ ꜰᴏʀ ꜱᴘᴀᴍᴍɪɴɢ`) 
                                });
                            }
                            user.spamCount = 0;
                        }
                    } else {
                        user.spamCount = 0;
                    }
                    user.lastMessageTime = now;
                    await user.save();
                } else {
                    await User.create({
                        jid: sender,
                        name: pushname,
                        lastMessageTime: now,
                        messageCount: 1
                    });
                }
            } catch (error) {
                console.error("Antispam error:", error);
            }
        }

        // AUTO-BLOCK COUNTRY
        if (config.autoblock.length > 0 && !isOwner) {
            const countryCode = sender.split('@')[0].substring(0, 3);
            const cleanCode = countryCode.replace('+', '');
            
            if (config.autoblock.includes(cleanCode)) {
                try {
                    await conn.updateBlockStatus(sender, 'block');
                    await conn.sendMessage(config.ownerNumber + '@s.whatsapp.net', { 
                        text: fancy(`🚫 ᴀᴜᴛᴏʙʟᴏᴄᴋ: ʙʟᴏᴄᴋᴇᴅ ${countryCode} ᴜꜱᴇʀ\nJID: ${sender}`) 
                    });
                    return;
                } catch (error) {
                    console.error("Autoblock error:", error);
                }
            }
        }

        // GROUP SECURITY FEATURES
        if (isGroup && !isOwner) {
            // ANTI-LINK
            if (config.antilink && body && body.match(/https?:\/\//gi)) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    
                    await conn.sendMessage(from, { 
                        text: fancy(`⚠️ ᴀɴᴛɪʟɪɴᴋ ᴡᴀʀɴɪɴɢ\n@${sender.split('@')[0]} sent a link\nWarning 1/3`),
                        mentions: [sender]
                    });
                    
                    let user = await User.findOne({ jid: sender });
                    if (user) {
                        user.warnings = (user.warnings || 0) + 1;
                        if (user.warnings >= 3) {
                            await conn.groupParticipantsUpdate(from, [sender], "remove");
                            await conn.sendMessage(from, { 
                                text: fancy(`🚫 ᴜꜱᴇʀ ʀᴇᴍᴏᴠᴇᴅ\n@${sender.split('@')[0]} has been removed for 3 warnings`),
                                mentions: [sender]
                            });
                            user.warnings = 0;
                        }
                        await user.save();
                    }
                    
                    return;
                } catch (error) {
                    console.error("Antilink error:", error);
                }
            }

            // ANTI-SCAM
            if (config.antiscam && body && config.scamWords.some(w => body.toLowerCase().includes(w))) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    
                    const metadata = await conn.groupMetadata(from);
                    const mentions = metadata.participants.map(p => p.id);
                    
                    await conn.sendMessage(from, { 
                        text: fancy(`⚠️ ꜱᴄᴀᴍ ᴀʟᴇʀᴛ!\n@${sender.split('@')[0]} ꜱᴇɴᴛ ᴀ ꜱᴄᴀᴍ ᴍᴇꜱꜱᴀɢᴇ\nᴡᴀʀɴɪɴɢ ꜰᴏʀ ᴀʟʟ ꜱᴏᴜʟꜱ!`),
                        mentions: mentions
                    });
                    
                    await conn.groupParticipantsUpdate(from, [sender], "remove");
                    
                    return;
                } catch (error) {
                    console.error("Antiscam error:", error);
                }
            }

            // ANTI-PORN
            if (config.antiporn && body && config.pornWords.some(w => body.toLowerCase().includes(w))) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    
                    await conn.sendMessage(from, { 
                        text: fancy(`🚫 ᴀɴᴛɪᴘᴏʀɴ\n@${sender.split('@')[0]} sent adult content\nMessage deleted`),
                        mentions: [sender]
                    });
                    
                    await conn.groupParticipantsUpdate(from, [sender], "remove");
                    
                    return;
                } catch (error) {
                    console.error("Antiporn error:", error);
                }
            }

            // ANTI-TAG
            if (config.antitag && (body?.includes('@everyone') || 
                msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 10)) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    
                    await conn.sendMessage(from, { 
                        text: fancy(`⚠️ ᴀɴᴛɪᴛᴀɢ\n@${sender.split('@')[0]} excessive tagging detected`),
                        mentions: [sender]
                    });
                    
                    return;
                } catch (error) {
                    console.error("Antitag error:", error);
                }
            }

            // ANTI-MEDIA
            if (config.antimedia !== 'off') {
                const mediaTypes = {
                    'imageMessage': 'photo',
                    'videoMessage': 'video',
                    'stickerMessage': 'sticker'
                };
                
                if (mediaTypes[type] && 
                    (config.antimedia === 'all' || config.antimedia === mediaTypes[type])) {
                    try {
                        await conn.sendMessage(from, { delete: msg.key });
                        
                        await conn.sendMessage(from, { 
                            text: fancy(`🚫 ᴀɴᴛɪᴍᴇᴅɪᴀ\n@${sender.split('@')[0]} ${mediaTypes[type]} not allowed`),
                            mentions: [sender]
                        });
                        
                        return;
                    } catch (error) {
                        console.error("Antimedia error:", error);
                    }
                }
            }
        }

        // AI CHATBOT
        if (!isCmd && !msg.key.fromMe && body && body.trim().length > 1) {
            if (config.autoTyping) {
                try {
                    await conn.sendPresenceUpdate('composing', from);
                } catch (error) {
                    console.error("Auto typing error:", error);
                }
            }
            
            try {
                const aiRes = await axios.get(`${config.aiModel}${encodeURIComponent(body)}?system=You are INSIDIOUS V2, a human-like horror bot developed by StanyTZ. Detect user's language and reply in the same language. If they use Swahili, reply in Swahili.`);
                
                const response = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy(aiRes.data)}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                
                await conn.sendMessage(from, { 
                    text: response,
                    contextInfo: { 
                        isForwarded: true, 
                        forwardedNewsletterMessageInfo: { 
                            newsletterJid: config.newsletterJid, 
                            newsletterName: config.botName 
                        } 
                    }
                }, { quoted: msg });
            } catch (e) { 
                console.error("AI Error:", e);
                const fallback = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy("I understand, tell me more!")}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                await conn.sendMessage(from, { text: fallback });
            }
        }

        // COMMAND HANDLING
        if (isCmd) {
            if (config.autoTyping) {
                try {
                    await conn.sendPresenceUpdate('composing', from);
                } catch (error) {
                    console.error("Command typing error:", error);
                }
            }

            const cmdPath = path.join(__dirname, 'commands');
            
            try {
                if (fs.existsSync(cmdPath)) {
                    const categories = fs.readdirSync(cmdPath);
                    
                    for (const cat of categories) {
                        const commandFile = path.join(cmdPath, cat, `${command}.js`);
                        if (fs.existsSync(commandFile)) {
                            const cmd = require(commandFile);
                            return await cmd.execute(conn, msg, args, { 
                                from, 
                                sender, 
                                fancy, 
                                isOwner, 
                                pushname,
                                config 
                            });
                        }
                    }
                    
                    // Command not found
                    await conn.sendMessage(from, { 
                        text: fancy(`Command "${command}" not found.\nType ${config.prefix}menu for available commands.`) 
                    });
                }
            } catch (err) {
                console.error("Command loader error:", err);
                await conn.sendMessage(from, { 
                    text: fancy(`Error executing command: ${err.message}`) 
                });
            }
        }

    } catch (err) {
        console.error("Handler Error:", err);
    }
};