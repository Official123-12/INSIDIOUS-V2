const crypto = require('crypto');
const Session = require('./models/Session');
const { proto } = require('@whiskeysockets/baileys');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // must be 32 bytes
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be set and exactly 32 characters long');
}
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function useMongoDBAuthState(sessionId) {
  let sessionDoc = await Session.findOne({ sessionId });

  if (!sessionDoc) {
    // Create empty credentials
    const creds = proto.AuthenticationCreds.create({});
    const keys = {};

    sessionDoc = new Session({
      sessionId,
      creds: encrypt(JSON.stringify(creds)),
      keys: encrypt(JSON.stringify(keys))
    });
    await sessionDoc.save();
  }

  const creds = JSON.parse(decrypt(sessionDoc.creds));
  const keys = JSON.parse(decrypt(sessionDoc.keys));

  const saveCreds = async () => {
    await Session.updateOne(
      { sessionId },
      {
        creds: encrypt(JSON.stringify(creds)),
        keys: encrypt(JSON.stringify(keys)),
        phoneNumber: creds.me?.id?.split(':')[0] || sessionDoc.phoneNumber
      }
    );
  };

  return { creds, keys, saveCreds };
}

module.exports = { useMongoDBAuthState, encrypt, decrypt };