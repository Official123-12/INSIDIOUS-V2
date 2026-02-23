const mongoose = require('mongoose');

// Session Schema
const sessionSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // sessionId as ID
    creds: { type: Object, default: {} },
    keys: { type: Object, default: {} },
    metadata: {
        phoneNumber: String,
        device: String,
        createdAt: { type: Date, default: Date.now },
        lastActive: Date,
        status: { type: String, default: 'pending' } // pending, active, disconnected
    }
}, { collection: 'sessions' });

// Prevent multiple model registration
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

/**
 * Create MongoDB-backed auth state for Baileys
 * @param {string} sessionId 
 * @returns {Promise<{state, saveCreds}>}
 */
async function useMongoAuthState(sessionId) {
    let sessionDoc = await Session.findById(sessionId);
    
    if (!sessionDoc) {
        sessionDoc = new Session({ _id: sessionId });
        await sessionDoc.save();
    }

    const saveCreds = async (creds) => {
        await Session.findByIdAndUpdate(sessionId, {
            creds: creds,
            'metadata.lastActive': new Date()
        }, { upsert: true });
    };

    const saveKey = async (key) => {
        await Session.findByIdAndUpdate(sessionId, {
            $set: { [`keys.${key.id}`]: key.key },
            'metadata.lastActive': new Date()
        });
    };

    const getKey = async (type, id) => {
        const session = await Session.findById(sessionId);
        return session?.keys?.[id] || null;
    };

    const deleteKey = async (type, id) => {
        await Session.findByIdAndUpdate(sessionId, {
            $unset: { [`keys.${id}`]: '' },
            'metadata.lastActive': new Date()
        });
    };

    const listKeys = async () => {
        const session = await Session.findById(sessionId);
        return session?.keys || {};
    };

    return {
        state: {
            creds: sessionDoc.creds,
            keys: { get: getKey, set: saveKey, delete: deleteKey, list: listKeys }
        },
        saveCreds
    };
}

/**
 * Delete session from MongoDB
 * @param {string} sessionId 
 */
async function deleteMongoSession(sessionId) {
    await Session.findByIdAndDelete(sessionId);
}

/**
 * Update session metadata
 * @param {string} sessionId 
 * @param {object} meta 
 */
async function updateSessionMeta(sessionId, meta) {
    await Session.findByIdAndUpdate(sessionId, {
        $set: { 
            'metadata': { ...meta, lastActive: new Date() }
        }
    });
}

/**
 * List all sessions from MongoDB
 * @returns {Promise<Array>}
 */
async function listMongoSessions() {
    return await Session.find({}, '_id metadata').lean();
}

module.exports = {
    useMongoAuthState,
    deleteMongoSession,
    updateSessionMeta,
    listMongoSessions,
    Session
};

