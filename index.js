const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (HTML yako)
app.use(express.static(path.join(__dirname, 'public')));

// Global variables
let sock = null;
let isConnected = false;

// ===== START BOT =====
async function startBot() {
    try {
        console.log("🤖 Starting bot...");
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ["INSIDIOUS", "Safari", "2.1.1"],
            syncFullHistory: false
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log("✅ BOT CONNECTED!");
                isConnected = true;
            }
            
            if (connection === 'close') {
                console.log("❌ Connection closed");
                isConnected = false;
                
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log("🔄 Reconnecting in 5s...");
                    setTimeout(startBot, 5000);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
    } catch (err) {
        console.error("Failed to start:", err);
        setTimeout(startBot, 10000);
    }
}

startBot();

// ===== PAIRING ENDPOINT – HII NDIO MSINGI =====
app.get('/pair', async (req, res) => {
    try {
        const num = req.query.num;
        
        if (!num) {
            return res.json({ error: "Namba haipo" });
        }
        
        // Clean number
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (cleanNum.length < 10) {
            return res.json({ error: "Namba fupi mno" });
        }
        
        console.log(`🔑 Pairing requested for: ${cleanNum}`);
        
        // Check if bot is connected
        if (!isConnected) {
            return res.json({ error: "Bot haijaunganishwa bado. Subiri sekunde 30." });
        }
        
        if (!sock) {
            return res.json({ error: "Bot socket haipo" });
        }
        
        // Generate code
        const code = await sock.requestPairingCode(cleanNum);
        console.log(`✅ Code generated: ${code}`);
        
        // Return code ONLY – HTML yako inatarajia hii
        res.json({ code: code });
        
    } catch (err) {
        console.error("❌ Pairing error:", err.message);
        res.json({ error: err.message });
    }
});

// ===== API STATS – KWA AJILI YA HTML YAKO =====
app.get('/api/stats', (req, res) => {
    res.json({
        uptime: process.uptime(),
        connected: isConnected
    });
});

// ===== STATUS CHECK =====
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        time: new Date().toISOString()
    });
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.send("OK");
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🔗 Test pairing: http://localhost:${PORT}/pair?num=255618558502`);
});

module.exports = app;