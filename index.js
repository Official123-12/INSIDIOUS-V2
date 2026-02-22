const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const path = require('path');
const { useMongoDBAuthState } = require('./mongoAuth'); // Hii ni helper yako

const app = express();
const PORT = process.env.PORT || 3000;
const globalConns = new Map(); // Active connections
const pairingSessions = new Map(); // Temporary pairing sockets

// Utility ya logging
const fancy = (text) => `[${new Date().toLocaleTimeString()}] ${text}`;

// ==================== Mfumo Mkuu wa Bot ====================

async function startBot(sessionId, forceNew = false) {
    // Kama connection tayari ipo na haija-force new, return existing
    if (!forceNew && globalConns.has(sessionId)) {
        const existing = globalConns.get(sessionId);
        if (existing.ws.readyState === 1) { // WebSocket.OPEN
            console.log(fancy(`⚡ Using existing connection: ${sessionId}`));
            return existing;
        }
    }

    // Futa connection iliyo-kwama kama ipo
    if (globalConns.has(sessionId)) {
        const oldConn = globalConns.get(sessionId);
        try { oldConn.end(); } catch(e) {}
        globalConns.delete(sessionId);
    }

    try {
        console.log(fancy(`🚀 Starting bot: ${sessionId}`));
        
        const { state, saveCreds } = await useMongoDBAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000, // Ongeza ili iwe imara kwa Railway
            syncFullHistory: false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: false,
            // Muhimu kwa Railway (WebSocket keepalive)
            waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
            patchMessageBeforeSending: (message) => {
                const requiresPatch = !!(
                    message.buttonsMessage ||
                    message.listMessage ||
                    message.templateMessage
                );
                if (requiresPatch) {
                    message = {
                        viewOnceMessageV2: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {},
                                },
                                ...message,
                            },
                        },
                    };
                }
                return message;
            },
        });

        // Hifadhi kwenye map
        globalConns.set(sessionId, conn);

        // ==================== Event Handlers ====================

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log(fancy(`[${sessionId}] Connection: ${connection}`));

            // QR code received (rare kwa authenticated session)
            if (qr) {
                console.log(fancy(`⚠️ QR received for ${sessionId} - needs re-pairing`));
            }

            // Connection opened successfully
            if (connection === 'open') {
                console.log(fancy(`✅ Bot Online: ${sessionId} (${conn.user?.id || 'unknown'})`));
                
                // Notify admin
                try {
                    await conn.sendMessage(conn.user.id, { 
                        text: fancy("🤖 Bot reconnected successfully!") 
                    });
                } catch (e) {}
            }

            // Connection closed - handle reconnection logic
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(fancy(`❌ Connection closed: ${sessionId}, Code: ${statusCode}, Reconnect: ${shouldReconnect}`));

                // Safisha
                globalConns.delete(sessionId);

                if (shouldReconnect) {
                    // Exponential backoff ili kueza kuzuiwa na WhatsApp
                    const delay = Math.min(5000 * (conn.reconnectAttempts || 1), 30000);
                    conn.reconnectAttempts = (conn.reconnectAttempts || 0) + 1;
                    
                    console.log(fancy(`⏳ Reconnecting ${sessionId} in ${delay}ms...`));
                    
                    setTimeout(() => {
                        startBot(sessionId, true);
                    }, delay);
                } else {
                    // Logged out - futa credentials
                    console.log(fancy(`🗑️ Logged out, clearing auth for ${sessionId}`));
                    await useMongoDBAuthState(sessionId).then(s => s.clearAll()); // Implement clearAll kwenye helper
                }
            }
        });

        // Save credentials automatically
        conn.ev.on('creds.update', saveCreds);

        // Message handler
        conn.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                // Your message handler here
                // require('./handler')(conn, m);
            }
        });

        // Error handling kwa socket
        conn.ws.on('error', (err) => {
            console.error(fancy(`WebSocket error ${sessionId}:`), err.message);
        });

        return conn;

    } catch (e) {
        console.error(fancy(`💥 Error starting bot ${sessionId}:`), e);
        globalConns.delete(sessionId);
        
        // Retry baada ya error
        setTimeout(() => startBot(sessionId, true), 10000);
        return null;
    }
}

// ==================== Pairing Endpoint Imara ====================

app.get('/pair', async (req, res) => {
    const num = req.query.num;
    
    // Validation
    if (!num) return res.status(400).json({ error: "No number provided" });
    const cleanNum = num.replace(/[^0-9]/g, '');
    if (cleanNum.length < 10) return res.status(400).json({ error: "Invalid number format" });

    // Zuia pairing mara mbili kwa namba moja
    if (pairingSessions.has(cleanNum)) {
        return res.status(429).json({ 
            error: "Pairing already in progress for this number. Please wait." 
        });
    }

    let tempConn = null;
    let timeoutId = null;
    let resolved = false;

    const cleanup = async () => {
        if (resolved) return;
        resolved = true;
        
        pairingSessions.delete(cleanNum);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        if (tempConn) {
            try {
                tempConn.removeAllListeners('connection.update');
                tempConn.removeAllListeners('creds.update');
                tempConn.end();
            } catch (e) {}
        }
    };

    try {
        console.log(fancy(`📱 Starting pairing for: ${cleanNum}`));
        pairingSessions.set(cleanNum, true);

        // 1. Futa credentials zilizopita (moja kwa moja)
        await useMongoDBAuthState(cleanNum).then(s => s.clearAll?.() || s);

        // 2. Undwa auth state mpya
        const { state, saveCreds } = await useMongoDBAuthState(cleanNum);
        const { version } = await fetchLatestBaileysVersion();

        // 3. Socket ya pairing
        tempConn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: false,
            syncFullHistory: false,
        });

        // Timeout ya 60 seconds
        timeoutId = setTimeout(async () => {
            if (!resolved) {
                console.log(fancy(`⏰ Pairing timeout for ${cleanNum}`));
                res.status(408).json({ error: "Pairing timeout – please try again." });
                await cleanup();
            }
        }, 60000);

        // Connection handler
        tempConn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            // Connection opened - sasa tuma pairing code
            if (connection === 'open') {
                try {
                    console.log(fancy(`🔗 Connected for pairing: ${cleanNum}`));
                    
                    // Request pairing code
                    const code = await tempConn.requestPairingCode(cleanNum);
                    console.log(fancy(`🔢 Code generated: ${code} for ${cleanNum}`));

                    // Setup creds listener kwa credentials za muda
                    tempConn.ev.on('creds.update', saveCreds);

                    // Response kwa user
                    if (!resolved) {
                        res.json({ 
                            success: true, 
                            code: code,
                            message: "Enter this code in your WhatsApp (Linked Devices)"
                        });
                    }

                    // Subiri kidogo kukamilisha authentication halisi
                    setTimeout(async () => {
                        await cleanup();
                        
                        // Sasa anza bot kwa kawaida (credentials zimehifadhiwa)
                        console.log(fancy(`🔄 Transitioning to permanent bot: ${cleanNum}`));
                        await startBot(cleanNum, true);
                    }, 8000); // Subiri credentials zihifadhiwe

                } catch (err) {
                    console.error(fancy(`❌ Pairing code failed ${cleanNum}:`), err);
                    if (!resolved) {
                        res.status(500).json({ error: "Failed to generate pairing code" });
                        await cleanup();
                    }
                }
            }

            // Connection closed before getting code
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(fancy(`🔌 Pairing connection closed ${cleanNum}, code: ${statusCode}`));
                
                if (!resolved && statusCode !== DisconnectReason.loggedOut) {
                    // Jaribu tena mara moja
                    setTimeout(() => {
                        if (!resolved) {
                            res.status(500).json({ error: "Connection lost during pairing" });
                            cleanup();
                        }
                    }, 2000);
                }
            }
        });

    } catch (e) {
        console.error(fancy(`💥 Pairing error ${cleanNum}:`), e);
        if (!resolved) {
            res.status(500).json({ error: "Internal pairing error" });
        }
        await cleanup();
    }
});

// ==================== Management Endpoints ====================

// Start existing bot (baada ya pairing au restart)
app.post('/start', express.json(), async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "No sessionId" });
    
    const conn = await startBot(sessionId, true);
    res.json({ 
        success: !!conn, 
        status: conn ? 'connected' : 'failed',
        user: conn?.user?.id || null
    });
});

// Health check
app.get('/health', (req, res) => {
    const bots = Array.from(globalConns.entries()).map(([id, conn]) => ({
        id,
        status: conn.ws?.readyState === 1 ? 'online' : 'connecting',
        user: conn.user?.id || null
    }));
    
    res.json({ 
        status: 'running', 
        activeBots: globalConns.size,
        pairingInProgress: pairingSessions.size,
        bots 
    });
});

// Stop bot
app.post('/stop', express.json(), async (req, res) => {
    const { sessionId } = req.body;
    if (globalConns.has(sessionId)) {
        const conn = globalConns.get(sessionId);
        try { conn.end(); } catch(e) {}
        globalConns.delete(sessionId);
        res.json({ success: true, message: "Bot stopped" });
    } else {
        res.status(404).json({ error: "Bot not found" });
    }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Error handling
app.use((err, req, res, next) => {
    console.error(fancy('Express error:'), err);
    res.status(500).json({ error: "Server error" });
});

// Start server
app.listen(PORT, () => {
    console.log(fancy(`🌐 Server started on port ${PORT}`));
    
    // Restore bots zilizokuwa active (optional)
    // restoreActiveBots(); 
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log(fancy('🛑 SIGTERM received, closing connections...'));
    for (const [id, conn] of globalConns) {
        try { conn.end(); } catch(e) {}
    }
    process.exit(0);
});
