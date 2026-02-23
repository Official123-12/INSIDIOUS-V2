const Session = require('../models/Session');

async function useMongoAuthState(phoneNumber) {
  let session = await Session.findById(phoneNumber);
  if (!session) {
    session = new Session({ _id: phoneNumber, creds: {}, keys: {} });
    await session.save();
  }

  const keysCache = new Map(Object.entries(session.keys || {}));

  const keys = {
    get: async (type, ids) => {
      const data = {};
      for (const id of ids) {
        const key = `${type}:${id}`;
        if (keysCache.has(key)) data[id] = keysCache.get(key);
      }
      return data;
    },
    set: async (data) => {
      for (const key in data) {
        keysCache.set(key, data[key]);
      }
      session.keys = Object.fromEntries(keysCache);
      await session.save();
    }
  };

  const saveCreds = async () => {
    session.creds = state.creds;
    await session.save();
  };

  const state = {
    creds: session.creds,
    keys
  };

  return { state, saveCreds };
}

module.exports = useMongoAuthState;