const Session = require('../models/Session');
const { initAuthCreds } = require('@whiskeysockets/baileys');

/**
 * Creates an in‑memory key store that implements the SignalKeyStore interface.
 * The internal data can be extracted for persistence.
 */
function createKeyStore(initialKeys = {}) {
    const data = initialKeys; // this will be modified in place
    return {
        data, // expose for saving
        store: {
            get: async (type, ids) => {
                const typeData = data[type];
                if (!typeData) return null;
                if (Array.isArray(ids)) {
                    return ids.map(id => typeData[id] || null);
                }
                return typeData[ids] || null;
            },
            set: async (entries) => {
                for (const { type, id, value } of entries) {
                    if (!data[type]) data[type] = {};
                    data[type][id] = value;
                }
            }
        }
    };
}

async function useMongoAuthState(phoneNumber) {
    let session = await Session.findOne({ phoneNumber });

    if (!session) {
        // No existing session – create fresh credentials
        const newCreds = initAuthCreds();
        const { store, data } = createKeyStore({}); // empty keys initially

        return {
            state: {
                creds: newCreds,
                keys: store
            },
            saveCreds: async (credsUpdate) => {
                // This will be called when creds change; we store both creds and current keys
                await Session.findOneAndUpdate(
                    { phoneNumber },
                    { $set: { creds: credsUpdate, keys: data } },
                    { upsert: true, new: true }
                );
            },
            // Expose the key data for later saving (used in creds.update event)
            keyData: data
        };
    }

    // Existing session – restore keys into a proper store
    const { store, data } = createKeyStore(session.keys);
    return {
        state: {
            creds: session.creds,
            keys: store
        },
        saveCreds: async (credsUpdate) => {
            await Session.findOneAndUpdate(
                { phoneNumber },
                { $set: { creds: credsUpdate, keys: data } },
                { new: true }
            );
        },
        keyData: data
    };
}

module.exports = useMongoAuthState;