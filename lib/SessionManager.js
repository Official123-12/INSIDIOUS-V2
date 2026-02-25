const { default: makeWASocket, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { useMongoAuthState } = require('./mongoAuth');
const handler = require('./handler');

class SessionManager {
    constructor(mongoUri) {
        this.mongoUri = mongoUri;
        this.sessions = new Map(); // sessionId -> { conn, mongoClient }
    }

    /**
     * Create new session for a user
     */
    async createSession(sessionId, phoneNumber) {
        if (this.sessions.has(sessionId)) {
            return { success: false, error: 'Session already exists' };
        }

        try {
            const { state, saveCreds, clearSession, client: mongoClient } = await useMongoAuthState(
                sessionId, 
                this.mongoUri
            );
            
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
                printQRInTerminal: false
            });

            // Store session reference
            this.sessions.set(sessionId, { conn, mongoClient, saveCreds, clearSession, phoneNumber });

            // Setup event listeners
            this._setupEventListeners(conn, sessionId, saveCreds, clearSession);

            return { success: true, conn };
            
        } catch (error) {
            console.error(`Failed to create session ${sessionId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get existing session by ID
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Remove/disconnect a session
     */
    async removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        try {
            session.conn?.end?.();
            session.mongoClient?.close?.();
            await session.clearSession?.();
            this.sessions.delete(sessionId);
            return true;
        } catch (error) {
            console.error(`Failed to remove session ${sessionId}:`, error.message);
            return false;
        }
    }

    /**
     * Reconnect all sessions from MongoDB (for Railway restarts)
     */
    async reconnectAllSessions() {
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(this.mongoUri);
        await client.connect();
        
        const db = client.db('whatsapp_sessions');
        const sessions = await db.collection('sessions')
            .find({ status: 'connected' })
            .toArray();

        console.log(`🔄 Reconnecting ${sessions.length} sessions...`);
        
        for (const sessionDoc of sessions) {
            const { sessionId, phoneNumber } = sessionDoc;
            console.log(`  ↪ Reconnecting ${phoneNumber || sessionId}...`);
            
            await this.createSession(sessionId, phoneNumber);
        }
        
        await client.close();
    }

    /**
     * Setup event listeners for a connection
     */
    _setupEventListeners(conn, sessionId, saveCreds, clearSession) {
        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // You could emit QR via WebSocket to your frontend
                console.log(`📱 QR ready for session: ${sessionId}`);
            }

            if (connection === 'open') {
                console.log(`✅ Session ${sessionId} connected: ${conn.user?.id}`);
                
                // Initialize handler for this session
                if (handler?.init && typeof handler.init === 'function') {
                    await handler.init(conn, sessionId);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    console.log(`🔄 Session ${sessionId} reconnecting...`);
                    setTimeout(() => {
                        this.createSession(sessionId, this.sessions.get(sessionId)?.phoneNumber);
                    }, 5000);
                } else {
                    console.log(`🚫 Session ${sessionId} logged out`);
                    this.removeSession(sessionId);
                }
            }
        });

        // Message handler (pass sessionId to distinguish users)
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m, sessionId); // Pass sessionId to handler
                }
            } catch (error) {
                console.error(`Message handler error for ${sessionId}:`, error.message);
            }
        });
    }
}

module.exports = SessionManager;

