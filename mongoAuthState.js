const { BufferJSON } = require('@whiskeysockets/baileys');
const Session = require('./models/Session');

async function useMongoAuthState(sessionId) {
    const writeData = async (data, file) => {
        const update = { updatedAt: new Date() };
        if (file === 'creds') {
            update.creds = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
        } else {
            const keysObj = {};
            for (const [id, keyData] of data.entries()) {
                keysObj[id] = JSON.parse(JSON.stringify(keyData, BufferJSON.replacer));
            }
            update.keys = keysObj;
        }
        await Session.findOneAndUpdate({ sessionId }, update, { upsert: true });
    };

    const readData = async (file) => {
        const session = await Session.findOne({ sessionId });
        if (!session) return file === 'creds' ? null : new Map();

        if (file === 'creds') {
            if (!session.creds || typeof session.creds !== 'object') return null;
            return JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver);
        } else {
            const map = new Map();
            if (session.keys && typeof session.keys === 'object') {
                for (const [id, value] of Object.entries(session.keys)) {
                    map.set(id, JSON.parse(JSON.stringify(value), BufferJSON.reviver));
                }
            }
            return map;
        }
    };

    const state = {
        creds: await readData('creds') || undefined,
        keys: await readData('keys') || new Map()
    };

    const saveCreds = async () => {
        await writeData(state.creds, 'creds');
    };

    const saveKeys = async () => {
        await writeData(state.keys, 'keys');
    };

    return { state, saveCreds, saveKeys };
}

module.exports = useMongoAuthState;