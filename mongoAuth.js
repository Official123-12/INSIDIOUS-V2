const { BufferJSON } = require('@whiskeysockets/baileys');
const Session = require('./models/Session');

/**
 * Custom authentication state for Baileys using MongoDB
 * @param {string} sessionId - Unique session identifier
 * @returns {object} { state, saveCreds, saveKeys }
 */
async function useMongoAuthState(sessionId) {
    /**
     * Write data (creds or keys) to MongoDB
     * @param {object} data - The data to store
     * @param {string} file - Either 'creds' or 'keys'
     */
    const writeData = async (data, file) => {
        const update = { updatedAt: new Date() };
        
        if (file === 'creds') {
            // Convert creds to JSON with Buffer support
            update.creds = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
        } else {
            // Keys is a Map, convert to plain object
            const keysObj = {};
            for (const [id, keyData] of data.entries()) {
                keysObj[id] = JSON.parse(JSON.stringify(keyData, BufferJSON.replacer));
            }
            update.keys = keysObj;
        }

        await Session.findOneAndUpdate(
            { sessionId },
            update,
            { upsert: true, new: true }
        );
    };

    /**
     * Read data (creds or keys) from MongoDB
     * @param {string} file - Either 'creds' or 'keys'
     * @returns {object|null|Map} The stored data
     */
    const readData = async (file) => {
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return file === 'creds' ? null : new Map();
        }

        if (file === 'creds') {
            return session.creds 
                ? JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver)
                : null;
        } else {
            // Convert keys object back to Map
            const map = new Map();
            if (session.keys && typeof session.keys === 'object') {
                for (const [id, value] of Object.entries(session.keys)) {
                    map.set(id, JSON.parse(JSON.stringify(value), BufferJSON.reviver));
                }
            }
            return map;
        }
    };

    // Initialize state from database
    const state = {
        creds: await readData('creds') || undefined,
        keys: await readData('keys') || new Map()
    };

    /**
     * Save credentials to database
     */
    const saveCreds = async () => {
        await writeData(state.creds, 'creds');
    };

    /**
     * Save keys to database
     */
    const saveKeys = async () => {
        await writeData(state.keys, 'keys');
    };

    return {
        state,
        saveCreds,
        saveKeys
    };
}

module.exports = useMongoAuthState;