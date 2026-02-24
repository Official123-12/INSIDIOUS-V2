// index.js - INSIDIOUS BOT Backend
// WhatsApp Bot Deployment System

require('dotenv').config();
const express = require('express');
const http = require('http');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const pino = require('pino');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ==================== CONFIG ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/;
const TEMP_SESSION_EXPIRY = 30 * 60 * 1000;

// ==================== MONGODB SETUP ====================
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Bot Session Schema
const botSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'active', 'inactive', 'deleted'], 
        default: 'pending' 
    },
    settings: {
        antiviewonce: { type: Boolean, default: true },
        antidelete: { type: Boolean, default: true },
        autoread: { type: Boolean, default: true },
        chatbot: { type: Boolean, default: true },
        antilink: { type: Boolean, default: true },
        welcome: { type: Boolean, default: true }
    },
    deployedAt: { type: Date, default: Date.now },
    lastActive: { type: Date },
    messageCount: { type: Number, default: 0 }
}, { timestamps: true });

const BotSession = mongoose.model('BotSession', botSessionSchema);

// ==================== TEMPORARY STORAGE ====================
const tempSessions = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [id, data] of tempSessions.entries()) {
        if (now - data.createdAt > TEMP_SESSION_EXPIRY) {
            tempSessions.delete(id);
        }
    }
}, 10 * 60 * 1000);

// ==================== SESSION ID GENERATOR 🆔 ====================
function randomMegaId(len = 6, numLen = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${out}${Math.floor(Math.random() * Math.pow(10, numLen))}`;
}

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ==================== HEALTH CHECK ====================
app.get('/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const activeBots = await BotSession.countDocuments({ status: 'active' });
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: dbStatus,
            activeBots,
            tempSessions: tempSessions.size,
            uptime: process.uptime()
        });
    } catch (err) {
        res.status(500).json({ status: 'unhealthy', error: err.message });
    }
});

// ==================== API: PAIRING ====================
app.get('/pair', async (req, res) => {
    const { num } = req.query;
    
    if (!num || !/^[0-9]{10,15}$/.test(num)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid phone number. Use format: 2557XXXXXXXX' 
        });
    }

    let sock;
    let responded = false;

    try {
        // 🆔 Generate Session ID using randomMegaId
        const sessionId = randomMegaId(6, 4);
        console.log(`🔑 Generated Session ID for ${num}: ${sessionId}`);

        const { version } = await fetchLatestBaileysVersion();
        const authDir = path.join(__dirname, 'auth', `temp_${sessionId}`);
        await fs.mkdir(authDir, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['INSIDIOUS BOT', 'Chrome', '3.0'],
            markOnlineOnConnect: false
        });

        sock.ev.on('creds.update', saveCreds);

        const code = await sock.requestPairingCode(num);
        console.log(`📱 Pairing code for ${num}: ${code}`);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📷 QR code available');
            }

            if (connection === 'open') {
                console.log(`✅ ${num} successfully linked device`);

                try {
                    // 📩 MESSAGE 1: Welcome + Session ID (Complete Message)
                    const welcomeMsg = `🎉 *INSIDIOUS BOT ACTIVATED*\n\n✅ Device linked successfully!\n🆔 *Your Session ID:*\n\`${sessionId}\`\n\n🔹 *Save this ID* to deploy your bot\n🔹 Visit: https://insidious-bot.railway.app/deploy\n🔹 Enter your Session ID + Phone Number\n\n*Powered by Stanley Assanaly* 🇹🇿`;
                    
                    await sock.sendMessage(`${num}@s.whatsapp.net`, { 
                        text: welcomeMsg,
                        contextInfo: {
                            externalAdReply: {
                                title: 'INSIDIOUS BOT',
                                body: 'Premium Deployment',
                                thumbnailUrl: 'https://raw.githubusercontent.com/Official123-12/STANYFREEBOT-/refs/heads/main/IMG_1377.jpeg',
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    });

                    // ⏳ Delay between messages
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // 📩 MESSAGE 2: Session ID Only (For Easy Copy)
                    const sessionIdMsg = `🆔 *COPY YOUR SESSION ID*\n\n\`\`\`${sessionId}\`\`\`\n\n⚠️ Keep this private! Do not share with anyone.`;
                    
                    await sock.sendMessage(`${num}@s.whatsapp.net`, { text: sessionIdMsg });

                    console.log(`📤 Sent 2 welcome messages to ${num}`);

                } catch (msgErr) {
                    console.error('❌ Error sending welcome messages:', msgErr);
                }

                // 🚫 CLOSE CONNECTION - Bot NOT Active Yet!
                try {
                    await sock.logout();
                    console.log(`🔌 Connection closed for ${num} - awaiting deployment`);
                } catch (closeErr) {
                    console.error('⚠️ Error closing connection:', closeErr);
                    sock.end?.();
                }

                // 💾 Store in temporary storage
                tempSessions.set(sessionId, {
                    phoneNumber: num,
                    createdAt: Date.now(),
                    authState: state
                });

                if (!responded) {
                    responded = true;
                    res.json({ 
                        success: true, 
                        code, 
                        sessionId,
                        message: 'Pairing successful! Check WhatsApp for Session ID'
                    });
                }
                return;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`🔌 Connection closed: ${statusCode} - Reconnect: ${shouldReconnect}`);

                if (!responded && statusCode === DisconnectReason.badSession) {
                    responded = true;
                    res.status(400).json({ 
                        success: false, 
                        error: 'Invalid session. Please try pairing again' 
                    });
                } else if (!responded && statusCode === DisconnectReason.loggedOut) {
                    responded = true;
                    res.status(401).json({ 
                        success: false, 
                        error: 'Device logged out. Please pair again' 
                    });
                }
            }
        });

        sock.ev.on('error', (err) => {
            console.error('❌ Socket error:', err);
            if (!responded) {
                responded = true;
                res.status(500).json({ success: false, error: 'Connection error' });
            }
        });

        // Timeout
        const pairingTimeout = setTimeout(() => {
            if (!responded) {
                responded = true;
                console.log(`⏰ Pairing timeout for ${num}`);
                sock?.end?.();
                res.status(408).json({ 
                    success: false, 
                    error: 'Pairing timed out. Please try again' 
                });
            }
        }, 90000);

    } catch (err) {
        console.error('❌ Pairing error:', err);
        sock?.end?.();
        
        if (!responded) {
            responded = true;
            res.status(500).json({ 
                success: false, 
                error: err.message || 'Server error during pairing' 
            });
        }
    }
});

// ==================== API: DEPLOY ====================
app.post('/deploy', async (req, res) => {
    const { sessionId, number } = req.body;
    
    if (!sessionId || !number) {
        return res.status(400).json({ 
            success: false, 
            error: 'Session ID and phone number are required' 
        });
    }

    if (!/^[0-9]{10,15}$/.test(number)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid phone number format' 
        });
    }

    try {
        // 🔍 Verify Session ID from temporary storage
        const tempData = tempSessions.get(sessionId);
        
        if (!tempData) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid or expired Session ID. Please pair again.' 
            });
        }

        if (tempData.phoneNumber !== number) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number does not match Session ID' 
            });
        }

        console.log(`🚀 Deploying bot for ${number} with Session ID: ${sessionId}`);

        // 🗄️ Save to MongoDB - Bot becomes ACTIVE here
        const newBot = new BotSession({
            sessionId,
            phoneNumber: number,
            status: 'active',
            deployedAt: new Date(),
            settings: {
                antiviewonce: true,
                antidelete: true,
                autoread: true,
                chatbot: true,
                antilink: true,
                welcome: true
            }
        });
        
        await newBot.save();
        console.log(`💾 Saved to MongoDB: ${sessionId}`);

        // 🔄 Move auth files from temp to active
        const tempAuthDir = path.join(__dirname, 'auth', `temp_${sessionId}`);
        const activeAuthDir = path.join(__dirname, 'auth', `active_${sessionId}`);
        
        try {
            await fs.rename(tempAuthDir, activeAuthDir);
            console.log(`📁 Auth files moved to active: ${sessionId}`);
        } catch (moveErr) {
            console.warn('⚠️ Could not move auth files:', moveErr);
        }

        // 🧹 Remove from temporary storage
        tempSessions.delete(sessionId);

        res.json({ 
            success: true, 
            message: 'Bot deployed successfully!', 
            sessionId,
            status: 'active'
        });

        console.log(`✅ Bot DEPLOYED: ${number} | ${sessionId}`);

    } catch (err) {
        console.error('❌ Deploy error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message || 'Deployment failed' 
        });
    }
});

// ==================== API: SESSIONS ====================
app.get('/sessions', async (req, res) => {
    try {
        const sessions = await BotSession.find({ status: 'active' })
            .select('sessionId phoneNumber status deployedAt lastActive')
            .sort({ deployedAt: -1 })
            .limit(50);

        res.json({ 
            success: true, 
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                phoneNumber: s.phoneNumber,
                status: s.status,
                deployedAt: s.deployedAt,
                lastActive: s.lastActive
            }))
        });
    } catch (err) {
        console.error('❌ Sessions fetch error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
    }
});

// ==================== API: DELETE SESSION ====================
app.delete('/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const result = await BotSession.findOneAndUpdate(
            { sessionId },
            { status: 'deleted', deletedAt: new Date() },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        const authDir = path.join(__dirname, 'auth', `active_${sessionId}`);
        try {
            await fs.rm(authDir, { recursive: true, force: true });
            console.log(`🗑️ Deleted auth files: ${sessionId}`);
        } catch (err) {
            console.warn('⚠️ Could not delete auth files:', err);
        }

        tempSessions.delete(sessionId);

        res.json({ success: true, message: 'Session deleted successfully' });
        console.log(`🗑️ Session deleted: ${sessionId}`);

    } catch (err) {
        console.error('❌ Delete error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
});

// ==================== API: SETTINGS ====================
app.post('/settings', async (req, res) => {
    const { sessionId, settings } = req.body;
    
    if (!sessionId || !settings) {
        return res.status(400).json({ 
            success: false, 
            error: 'Session ID and settings required' 
        });
    }

    try {
        const result = await BotSession.findOneAndUpdate(
            { sessionId, status: 'active' },
            { $set: { settings, updatedAt: new Date() } },
            { new: true, runValidators: true }
        );

        if (!result) {
            return res.status(404).json({ 
                success: false, 
                error: 'Active session not found' 
            });
        }

        res.json({ success: true, message: 'Settings saved', settings: result.settings });
        console.log(`⚙️ Settings updated: ${sessionId}`);

    } catch (err) {
        console.error('❌ Settings error:', err);
        res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
});

// ==================== SPA FALLBACK ====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ==================== START SERVER ====================
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 INSIDIOUS BOT Server running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await mongoose.connection.close();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

