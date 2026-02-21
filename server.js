const express = require('express');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ PAIRING ENDPOINT – INATUMIA SOCKET YAKE MWENYEWE
app.get('/pair', async (req, res) => {
    const tempDir = path.join(__dirname, 'temp_pair_' + Date.now());
    let tempConn = null;
    
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /pair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }

        console.log(`🔑 Generating 8-digit code for: ${cleanNum}`);

        // 🔥 UNDA FOLDA YA MUDA
        await fs.promises.mkdir(tempDir, { recursive: true });
        const { state } = await useMultiFileAuthState(tempDir);
        const { version } = await fetchLatestBaileysVersion();

        tempConn = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: state.keys 
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: false
        });

        // 🔥 SUBIRI SOCKET IWE TAYARI
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket timeout')), 10000);
            tempConn.ev.on('connection.update', (update) => {
                if (update.connection === 'open') {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        // 🔥 O MBA PAIRING CODE
        const code = await Promise.race([
            tempConn.requestPairingCode(cleanNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
        ]);

        // 🔥 FUNGA SOCKET NA FUTA FOLDA
        if (tempConn?.ws) tempConn.ws.close();
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});

        res.json({ success: true, code, message: `8-digit pairing code: ${code}` });
        
    } catch (err) {
        console.error("Pairing error:", err.message);
        if (tempConn?.ws) tempConn.ws.close();
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        
        if (err.message.includes("already paired")) {
            res.json({ success: true, message: "Number already paired" });
        } else {
            res.json({ success: false, error: "Failed: " + err.message });
        }
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`🌐 Pairing server running on port ${PORT}`);
    console.log(`🔗 Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`);
});

module.exports = app;