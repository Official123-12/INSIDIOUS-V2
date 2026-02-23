const Session = require('../models/Session');

async function useMongoAuthState(phoneNumber) {
  let session = await Session.findOne({ phoneNumber });

  if (!session) {
    return {
      state: { creds: {}, keys: {} },
      saveCreds: async (credsUpdate) => {
        await Session.findOneAndUpdate(
          { phoneNumber },
          { $set: { creds: credsUpdate } },
          { upsert: true, new: true }
        );
      }
    };
  }

  return {
    state: {
      creds: session.creds,
      keys: session.keys
    },
    saveCreds: async (credsUpdate) => {
      await Session.findOneAndUpdate(
        { phoneNumber },
        { $set: { creds: credsUpdate } },
        { new: true }
      );
    }
  };
}

module.exports = useMongoAuthState;