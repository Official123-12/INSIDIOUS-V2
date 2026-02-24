This should work 
const express = require('express');
const { default: makeWASocket, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER ====================
const handler = require('./handler');

// ... (fancy function stays exactly the same)

// ... (app, PORT, mongoose.connect, middleware, public folder, simple routes stay the same)

// GLOBAL VARIABLES
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();

// LOAD CONFIG (unchanged)
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("❌ Config file error, using defaults"));
    config = {
        prefix: '.',
        ownerNumber: ['255000000000'],
        botName: 'INSIDIOUS',
        workMode: 'public',
        botImage: 'https://files.catbox.moe/f3c07u.jpg'
    };
}

// ======================
// NEW: MongoDB Auth State Helper (persists sessions in DB)
// ======================
async function getMongoAuthState(sessionId = 'insidious_session') {
    const db = mongoose.connection.db;
    const collection = db.collection('baileys_auth');

    const getCreds = async () => {
        const doc = await collection.findOne({ _id: 'creds' });
        return doc ? doc.data : {};
    };

    const getKeys = async (type, id) => {
        const doc = await collection.findOne({ _id: `\( {type}_ \){id}` });
        return doc ? doc.data : null;
    };

    const setCreds = async (data) => {
        await collection.updateOne(
            { _id: 'creds' },
            { $set: { data } },
            { upsert: true }
        );
    };

    const setKeys = async (type, id, data) => {
        await collection.updateOne(
            { _id: `\( {type}_ \){id}` },
            { $set: { data } },
            { upsert: true }
        );
    };

    const delKeys = async (type, id) => {
        await collection.deleteOne({ _id: `\( {type}_ \){id}` });
    };

    const clear = async () => {
        await collection.deleteMany({});
    };

    const state = {
        creds: await getCreds(),
        keys: {
            get: getKeys,
            set: setKeys,
            del: delKeys
        }
    };

    const saveCreds = () => setCreds(state.creds);

    return { state, saveCreds };
}

// ✅ MAIN BOT FUNCTION (edited minimally)
async function startBot() {
    try {
        console.log(fancy("🚀 Starting INSIDIOUS..."));

        // CHANGED: Use MongoDB auth instead of files
        const { state, saveCreds } = await getMongoAuthState('insidious_session');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({    
            version,    
            auth: {     
                creds: state.creds,     
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))     
            },    
            logger: pino({ level: "silent" }),    
            browser: Browsers.macOS("Safari"),    
            syncFullHistory: false,    
            connectTimeoutMs: 60000,    
            keepAliveIntervalMs: 10000,    
            markOnlineOnConnect: true    
        });    

        globalConn = conn;    
        botStartTime = Date.now();    

        // CONNECTION EVENT HANDLER (mostly unchanged)
        conn.ev.on('connection.update', async (update) => {    
            const { connection, lastDisconnect } = update;    
                
            if (connection === 'open') {    
                // ... (all your open logic stays exactly the same)
                console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));    
                console.log(fancy("✅ Bot is now online"));    
                    
                isConnected = true;    
                    
                let botName = conn.user?.name || "INSIDIOUS";    
                let botNumber = "Unknown";    
                let botId = conn.user?.id || "Unknown";    
                    
                if (conn.user?.id) {    
                    botNumber = conn.user.id.split(':')[0] || "Unknown";    
                }    
                    
                const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';    
                const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;    
                    
                console.log(fancy(`🤖 Name: ${botName}`));    
                console.log(fancy(`📞 Number: ${botNumber}`));    
                console.log(fancy(`🆔 Bot ID: ${botSecret}`));    
                console.log(fancy(`👥 Paired Owners: ${pairedCount}`));    
                    
                try {    
                    if (handler && typeof handler.init === 'function') {    
                        await handler.init(conn);    
                        console.log(fancy("✅ Handler initialized"));    
                    }    
                } catch (e) {    
                    console.error(fancy("❌ Handler init error:"), e.message);    
                }    
                    
                // welcome message (unchanged)
                setTimeout(async () => {    
                    try {    
                        if (config.ownerNumber && config.ownerNumber.length > 0) {    
                            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');    
                            if (ownerNum.length >= 10) {    
                                const ownerJid = ownerNum + '@s.whatsapp.net';    
                                    
                                const welcomeMsg = `...`;  // your message stays the same

                                await conn.sendMessage(ownerJid, {
                                    image: { url: config.botImage || "https://files.catbox.moe/f3c07u.jpg" },
                                    caption: welcomeMsg,
                                    contextInfo: {
                                        isForwarded: true,
                                        forwardingScore: 999,
                                        forwardedNewsletterMessageInfo: {
                                            newsletterJid: config.newsletterJid || "120363404317544295@newsletter",
                                            newsletterName: config.botName || "INSIDIOUS BOT"
                                        }
                                    }
                                });
                                console.log(fancy("✅ Welcome message sent to owner"));
                            }
                        }
                    } catch (e) {
                        console.log(fancy("⚠️ Could not send welcome message:"), e.message);
                    }
                }, 3000);
            }

            if (connection === 'close') {    
                console.log(fancy("🔌 Connection closed"));    
                isConnected = false;    
                    
                const statusCode = lastDisconnect?.error?.output?.statusCode;    
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;    
                    
                if (shouldReconnect) {    
                    console.log(fancy("🔄 Restarting bot in 5 seconds..."));    
                    setTimeout(() => {    
                        startBot();    
                    }, 5000);    
                } else {    
                    console.log(fancy("🚫 Logged out. Please scan QR again."));    
                }    
            }    
        });    

        conn.ev.on('creds.update', saveCreds);    

        // message, group, call handlers (unchanged)
        conn.ev.on('messages.upsert', async (m) => {    
            try {    
                if (handler && typeof handler === 'function') {    
                    await handler(conn, m);    
                }    
            } catch (error) {    
                console.error("Message handler error:", error.message);    
            }    
        });    

        conn.ev.on('group-participants.update', async (update) => {    
            try {    
                if (handler && handler.handleGroupUpdate) {    
                    await handler.handleGroupUpdate(conn, update);    
                }    
            } catch (error) {    
                console.error("Group update error:", error.message);    
            }    
        });    

        conn.ev.on('call', async (call) => {    
            try {    
                if (handler && handler.handleCall) {    
                    await handler.handleCall(conn, call);    
                }    
            } catch (error) {    
                console.error("Call handler error:", error.message);    
            }    
        });    

        console.log(fancy("🚀 Bot ready for pairing via web interface"));

    } catch (error) {
        console.error("Start error:", error.message);
        setTimeout(() => {
            startBot();
        }, 10000);
    }
}

// START BOT (unchanged call)
startBot();

// ==================== HTTP ENDPOINTS ====================

// ✅ PAIRING ENDPOINT – FIXED to not break main connection
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        }

        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }

        console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));    

        // CHANGED: Create TEMPORARY socket just for pairing (prevents closing main conn)
        const { state, saveCreds: tempSave } = await getMongoAuthState(`pair_temp_${Date.now()}`); // unique temp id
        const { version } = await fetchLatestBaileysVersion();

        const tempSock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            browser: Browsers.macOS("Safari"),
        });

        tempSock.ev.on('creds.update', tempSave);

        // Wait a bit until socket is ready (fixes most "Connection Closed" during pair)
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 sec delay - very important

        const code = await tempSock.requestPairingCode(cleanNum);

        // Clean up temp socket
        tempSock.end();

        res.json({     
            success: true,     
            code: code,    
            message: `8-digit pairing code: ${code}`    
        });

    } catch (err) {
        console.error("Pairing error:", err.message);
        if (err.message.includes("already paired") || err.message.includes("already exists")) {
            res.json({ success: true, message: "Number already paired" });
        } else {
            res.json({ success: false, error: "Failed: " + err.message });
        }
    }
});

// unpair, health, botinfo endpoints → unchanged

// START SERVER (unchanged)
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.1.1 | Year: 2025"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
});

module.exports = app;