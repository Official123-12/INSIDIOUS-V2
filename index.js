const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER ====================
const handler = require('./handler');

// ✅ **FANCY FUNCTION**
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    
    try {
        const fancyMap = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
        };
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            result += fancyMap[char] || char;
        }
        return result;
    } catch (e) {
        return text;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION (OPTIONAL)**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => {
    console.log(fancy("✅ MongoDB Connected"));
})
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
});

// ==================== MONGODB AUTH STATE ====================
const AuthSchema = new mongoose.Schema({
  sessionId: { type: String, default: 'default' },
  creds: { type: mongoose.Schema.Types.Mixed, default: {} },
  keys: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
const AuthModel = mongoose.model('Auth', AuthSchema);

async function useMongoDBAuthState(sessionId = 'default') {
  const writeData = async (data, type) => {
    await AuthModel.findOneAndUpdate(
      { sessionId },
      { [type]: data },
      { upsert: true }
    );
  };

  const readData = async (type) => {
    const doc = await AuthModel.findOne({ sessionId });
    return doc ? doc[type] : null;
  };

  const removeData = async () => {
    await AuthModel.deleteOne({ sessionId });
  };

  const creds = (await readData('creds')) || (await (await import('@whiskeysockets/baileys')).initAuthCreds)(sessionId);

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = (await readData('keys')) || {};
          return ids.reduce((acc, id) => {
            acc[id] = data[type]?.[id] || null;
            return acc;
          }, {});
        },
        set: async (data) => {
          const keys = (await readData('keys')) || {};
          Object.entries(data).forEach(([type, ids]) => {
            if (!keys[type]) keys[type] = {};
            Object.entries(ids).forEach(([id, value]) => {
              if (value) keys[type][id] = value;
              else delete keys[type][id];
            });
          });
          await writeData(keys, 'keys');
        }
      }
    },
    saveCreds: async () => {
      await writeData(creds, 'creds');
    }
  };
}

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ✅ **GLOBAL VARIABLES**
let globalConn = null;
let isConnected = false;
let botStartTime = Date.now();
let isStarting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BACKOFF = [5000, 10000, 30000, 60000, 120000]; // exponential backoff

// ✅ **LOAD CONFIG**
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

// ✅ **MAIN BOT FUNCTION**
async function startBot() {
  if (isStarting) {
    console.log(fancy("⏳ Bot already starting, skipping..."));
    return;
  }
  isStarting = true;

  try {
    console.log(fancy("🚀 Starting INSIDIOUS..."));
    
    // ✅ **AUTHENTICATION - MongoDB**
    const { state, saveCreds } = await useMongoDBAuthState('insidious_session');
    const { version } = await fetchLatestBaileysVersion();

    // ✅ **CREATE CONNECTION**
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
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false, // optional performance
      shouldSyncHistoryMessage: () => false // prevent history sync
    });

    globalConn = conn;
    botStartTime = Date.now();
    reconnectAttempts = 0; // reset on successful connection

    // ✅ **CONNECTION EVENT HANDLER**
    conn.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'open') {
        console.log(fancy("👹 INSIDIOUS: THE LAST KEY ACTIVATED"));
        console.log(fancy("✅ Bot is now online"));
        isConnected = true;
        reconnectAttempts = 0; // reset on successful connection
        
        // Get bot info
        let botName = conn.user?.name || "INSIDIOUS";
        let botNumber = "Unknown";
        let botId = conn.user?.id || "Unknown";
        
        if (conn.user?.id) {
          botNumber = conn.user.id.split(':')[0] || "Unknown";
        }
        
        // 🔥 GET BOT ID AND PAIRED COUNT FROM HANDLER
        const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
        const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
        
        console.log(fancy(`🤖 Name: ${botName}`));
        console.log(fancy(`📞 Number: ${botNumber}`));
        console.log(fancy(`🆔 Bot ID: ${botSecret}`));
        console.log(fancy(`👥 Paired Owners: ${pairedCount}`));
        
        // ✅ **INITIALIZE HANDLER**
        try {
          if (handler && typeof handler.init === 'function') {
            await handler.init(conn);
            console.log(fancy("✅ Handler initialized"));
          }
        } catch (e) {
          console.error(fancy("❌ Handler init error:"), e.message);
        }
        
        // ✅ **SEND WELCOME MESSAGE TO OWNER**
        setTimeout(async () => {
          try {
            if (config.ownerNumber && config.ownerNumber.length > 0) {
              const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
              if (ownerNum.length >= 10) {
                const ownerJid = ownerNum + '@s.whatsapp.net';
                
                const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🆔 *Bot ID:* ${botSecret}
👥 *Paired Owners:* ${pairedCount}

⚡ *Status:* ONLINE & ACTIVE

📊 *ALL FEATURES ACTIVE:*
🛡️ Anti View Once: ✅
🗑️ Anti Delete: ✅
🤖 AI Chatbot: ✅
⚡ Auto Typing: ✅
📼 Auto Recording: ✅
👀 Auto Read: ✅
❤️ Auto React: ✅
🎉 Welcome/Goodbye: ✅

🔧 *Commands:* All working
📁 *Database:* Connected
🚀 *Performance:* Optimal

👑 *Developer:* STANYTZ
💾 *Version:* 2.1.1 | Year: 2025`;
                
                // Send with image and forwarded style
                await conn.sendMessage(ownerJid, { 
                  image: { 
                    url: config.botImage || "https://files.catbox.moe/f3c07u.jpg"
                  },
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
          reconnectAttempts++;
          if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
            console.log(fancy(`❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Bot will stay offline.`));
            return;
          }
          
          const delay = RECONNECT_BACKOFF[Math.min(reconnectAttempts - 1, RECONNECT_BACKOFF.length - 1)] || 120000;
          console.log(fancy(`🔄 Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay/1000}s...`));
          
          setTimeout(() => {
            isStarting = false; // allow restart
            startBot();
          }, delay);
        } else {
          console.log(fancy("🚫 Logged out. Please re-pair using /pair."));
          // Optionally clear auth from DB
          // await AuthModel.deleteOne({ sessionId: 'insidious_session' });
        }
      }
    });

    // ✅ **CREDENTIALS UPDATE**
    conn.ev.on('creds.update', saveCreds);

    // ✅ **MESSAGE HANDLER**
    conn.ev.on('messages.upsert', async (m) => {
      try {
        if (handler && typeof handler === 'function') {
          await handler(conn, m);
        }
      } catch (error) {
        console.error("Message handler error:", error.message);
      }
    });

    // ✅ **GROUP UPDATE HANDLER**
    conn.ev.on('group-participants.update', async (update) => {
      try {
        if (handler && handler.handleGroupUpdate) {
          await handler.handleGroupUpdate(conn, update);
        }
      } catch (error) {
        console.error("Group update error:", error.message);
      }
    });

    // ✅ **CALL HANDLER**
    conn.ev.on('call', async (call) => {
      try {
        if (handler && handler.handleCall) {
          await handler.handleCall(conn, call);
        }
      } catch (error) {
        console.error("Call handler error:", error.message);
      }
    });

    // ✅ **KEEP-ALIVE HEARTBEAT (NEW)**
    const keepAlive = setInterval(() => {
      if (conn?.ws?.readyState === 1) { // WebSocket open
        conn.sendPresenceUpdate('available', conn.user.id); // or 'composing' to keep alive
      }
    }, 30000); // every 30 seconds
    conn.ev.on('connection.close', () => clearInterval(keepAlive));

    console.log(fancy("🚀 Bot ready for pairing via web interface"));
    
  } catch (error) {
    console.error("Start error:", error.message);
    // Attempt restart with backoff
    reconnectAttempts++;
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      const delay = RECONNECT_BACKOFF[Math.min(reconnectAttempts - 1, RECONNECT_BACKOFF.length - 1)] || 120000;
      setTimeout(() => {
        isStarting = false;
        startBot();
      }, delay);
    } else {
      console.log(fancy(`❌ Max startup attempts reached.`));
    }
  } finally {
    isStarting = false;
  }
}

// ✅ **START BOT**
startBot();

// ==================== HTTP ENDPOINTS ====================

// ✅ **PAIRING ENDPOINT (8-DIGIT CODE) – MODIFIED WITH CONNECTION STATE GUARD**
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
    
    // ✅ **CONNECTION STATE GUARD**
    if (!globalConn) {
      return res.json({ success: false, error: "Bot is initializing. Please try again in a few seconds." });
    }
    
    if (!isConnected) {
      return res.json({ success: false, error: "Bot is not fully connected yet. Please wait for 'Bot is now online' message." });
    }
    
    // Check if connection is actually ready (auth present)
    if (!globalConn.authState?.creds?.registered) {
      return res.json({ success: false, error: "Bot session not ready. Please wait." });
    }
    
    console.log(fancy(`🔑 Generating 8-digit code for: ${cleanNum}`));
    
    // Use AbortController for timeout (optional)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const code = await globalConn.requestPairingCode(cleanNum);
    clearTimeout(timeout);
    
    res.json({ 
      success: true, 
      code: code,
      message: `8-digit pairing code: ${code}`
    });
    
  } catch (err) {
    console.error("Pairing error:", err.message);
    if (err.message.includes("already paired")) {
      res.json({ success: true, message: "Number already paired" });
    } else {
      res.json({ success: false, error: "Failed: " + err.message });
    }
  }
});

// ✅ **UNPAIR ENDPOINT**
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /unpair?num=255123456789" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number" });
        }
        
        // Call handler to unpair
        let result = false;
        if (handler && handler.unpairNumber) {
            result = await handler.unpairNumber(cleanNum);
        } else {
            return res.json({ success: false, error: "Unpair function not available in handler" });
        }
        
        res.json({ 
            success: result, 
            message: result ? `Number ${cleanNum} unpaired successfully` : `Failed to unpair ${cleanNum}`
        });
        
    } catch (err) {
        console.error("Unpair error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ **HEALTH CHECK**
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        status: 'healthy',
        connected: isConnected,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ✅ **BOT INFO ENDPOINT**
app.get('/botinfo', (req, res) => {
    if (!globalConn || !globalConn.user) {
        return res.json({ 
            success: false,
            error: "Bot not connected",
            connected: isConnected
        });
    }
    
    const botSecret = handler.getBotId ? handler.getBotId() : 'Unknown';
    const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers().length : 0;
    
    res.json({
        success: true,
        botName: globalConn.user?.name || "INSIDIOUS",
        botNumber: globalConn.user?.id?.split(':')[0] || "Unknown",
        botJid: globalConn.user?.id || "Unknown",
        botSecret: botSecret,
        pairedOwners: pairedCount,
        connected: isConnected,
        uptime: Date.now() - botStartTime
    });
});

// ✅ **START SERVER**
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