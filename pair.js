const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const mongoose = require('mongoose');
const { useMongoDBAuthState, encrypt, decrypt } = require('./mongoAuth');
const Session = require('./models/Session');
const { makeid } = require('./id');
const handler = require('./handler'); // your main message handler
const config = require('./config');   // your config file

// ==================== GLOBAL SESSION MAP ====================
const activeSessions = new Map(); // key: phoneNumber (sanitized) -> { socket, sessionId, startTime }

// ==================== UTILITY FUNCTIONS ====================
function getZimbabweanTimestamp() {
  return new Date().toLocaleString('en-ZW', { timeZone: 'Africa/Harare' });
}

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

// ==================== START BOT FROM EXISTING SESSION ====================
async function startBotFromSession(sessionId) {
  const session = await Session.findOne({ sessionId });
  if (!session || session.status !== 'active') {
    throw new Error('Session not active');
  }

  const phoneNumber = session.phoneNumber;
  const sanitized = phoneNumber.replace(/[^0-9]/g, '');
  const sessionPath = path.join(os.tmpdir(), `session_${sanitized}`);

  // Write creds to temp folder (Baileys uses folder-based auth)
  fs.ensureDirSync(sessionPath);
  fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(JSON.parse(decrypt(session.creds)), null, 2));
  if (session.keys) {
    fs.writeFileSync(path.join(sessionPath, 'keys.json'), JSON.stringify(JSON.parse(decrypt(session.keys)), null, 2));
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Safari'),
    syncFullHistory: false,
  });

  activeSessions.set(sanitized, { socket, sessionId, startTime: Date.now() });

  // Creds update → save back to MongoDB
  socket.ev.on('creds.update', async () => {
    try {
      await saveCreds();
      const credsFile = fs.readFileSync(path.join(sessionPath, 'creds.json'), 'utf8');
      const keysFile = fs.readFileSync(path.join(sessionPath, 'keys.json'), 'utf8');
      await Session.updateOne(
        { sessionId },
        {
          creds: encrypt(credsFile),
          keys: encrypt(keysFile),
        }
      );
    } catch (err) {
      console.error('Failed to save creds update:', err);
    }
  });

  // Message handler
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg) return;
    try {
      if (handler && typeof handler === 'function') {
        await handler(socket, msg);
      }
    } catch (error) {
      console.error('Message handler error:', error);
    }
  });

  // Group participant updates
  if (handler.handleGroupUpdate) {
    socket.ev.on('group-participants.update', async (update) => {
      try {
        await handler.handleGroupUpdate(socket, update);
      } catch (error) {
        console.error('Group update error:', error);
      }
    });
  }

  // Call handler
  if (handler.handleCall) {
    socket.ev.on('call', async (calls) => {
      try {
        await handler.handleCall(socket, calls);
      } catch (error) {
        console.error('Call handler error:', error);
      }
    });
  }

  // Connection update
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log(`✅ Session ${sessionId} is online`);
      await Session.updateOne({ sessionId }, { status: 'active' });
    }
    if (connection === 'close') {
      console.log(`🔌 Session ${sessionId} closed`);
      activeSessions.delete(sanitized);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log(`🔄 Reconnecting session ${sessionId} in 5s...`);
        setTimeout(() => startBotFromSession(sessionId), 5000);
      } else {
        console.log(`🚫 Session ${sessionId} logged out.`);
        await Session.updateOne({ sessionId }, { status: 'expired' });
      }
    }
  });

  console.log(`Started bot for session ${sessionId} (${sanitized})`);
  return socket;
}

// ==================== PAIRING ENDPOINT ====================
router.get('/', async (req, res) => {
  const { num } = req.query;
  if (!num) {
    return res.json({ success: false, error: 'Provide number! Example: /pair?num=255123456789' });
  }

  const cleanNum = num.replace(/[^0-9]/g, '');
  if (cleanNum.length < 10) {
    return res.json({ success: false, error: 'Invalid number. Must be at least 10 digits.' });
  }

  if (activeSessions.has(cleanNum)) {
    return res.json({ success: false, error: 'Number already connected' });
  }

  // Create pending session
  const sessionId = makeid(8);
  const emptyCreds = JSON.stringify({});
  const emptyKeys = JSON.stringify({});
  await Session.create({
    sessionId,
    phoneNumber: cleanNum,
    creds: encrypt(emptyCreds),
    keys: encrypt(emptyKeys),
    status: 'pending'
  });

  try {
    const { state, saveCreds } = await useMongoDBAuthState(sessionId);
    const { version } = await fetchLatestBaileysVersion();

    const tempSocket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Safari'),
    });

    const code = await tempSocket.requestPairingCode(cleanNum);

    tempSocket.ev.on('creds.update', saveCreds);

    // Close after pairing completes
    setTimeout(() => {
      tempSocket.end(new Error('Pairing complete'));
    }, 5000);

    res.json({
      success: true,
      code,
      sessionId,
      message: `8-digit pairing code: ${code}`
    });
  } catch (err) {
    console.error('Pairing error:', err);
    await Session.deleteOne({ sessionId });
    if (err.message.includes('already paired')) {
      res.json({ success: true, message: 'Number already paired' });
    } else {
      res.json({ success: false, error: 'Failed: ' + err.message });
    }
  }
});

// ==================== DEPLOY ENDPOINT ====================
router.post('/deploy', async (req, res) => {
  try {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) {
      return res.json({ success: false, error: 'Missing sessionId or number' });
    }

    const sanitized = number.replace(/[^0-9]/g, '');
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.json({ success: false, error: 'Session not found' });
    }

    if (session.phoneNumber !== sanitized) {
      return res.json({ success: false, error: 'Number does not match session' });
    }

    if (activeSessions.has(sanitized)) {
      return res.json({ success: true, message: 'Bot already running' });
    }

    await startBotFromSession(sessionId);
    res.json({ success: true, message: 'Bot deployed successfully' });
  } catch (err) {
    console.error('Deploy error:', err);
    res.json({ success: false, error: err.message });
  }
});

// ==================== SESSIONS LIST ====================
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find({}, 'sessionId phoneNumber status -_id');
    res.json({ success: true, sessions });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ==================== DELETE SESSION ====================
router.delete('/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.json({ success: false, error: 'Session not found' });
    }

    if (activeSessions.has(session.phoneNumber)) {
      const { socket } = activeSessions.get(session.phoneNumber);
      try { await socket.logout(); } catch (e) {}
      try { socket.ws?.close(); } catch (e) {}
      activeSessions.delete(session.phoneNumber);
    }

    await Session.deleteOne({ sessionId });
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeSessions: activeSessions.size,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ==================== AUTO-RECONNECT ON STARTUP ====================
(async () => {
  try {
    const activeSessionsDb = await Session.find({ status: 'active' });
    for (const sess of activeSessionsDb) {
      if (!activeSessions.has(sess.phoneNumber)) {
        try {
          await startBotFromSession(sess.sessionId);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.error(`Failed to restart session ${sess.sessionId}:`, e);
        }
      }
    }
  } catch (e) {
    console.error('Auto-reconnect error:', e);
  }
})();

module.exports = router;