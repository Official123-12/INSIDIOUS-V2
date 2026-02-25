const Session = require('./models/Session');
const { initAuthCreds, BufferJSON, proto } = require("@whiskeysockets/baileys");

/**
 * MongoDB Authentication State Handler for Baileys
 * Properly persists both creds AND keys to MongoDB
 */
async function useMongoAuthState(sessionId) {
    
    // Initialize or fetch session from database
    let session = await Session.findOne({ sessionId });
    
    if (!session) {
        // Create new session document
        session = new Session({
            sessionId,
            status: 'pending',
            creds: null,
            keys: {}
        });
        await session.save();
        console.log(`[MongoAuth] Created new session: ${sessionId}`);
    } else {
        console.log(`[MongoAuth] Loaded existing session: ${sessionId} (status: ${session.status})`);
    }

    // Initialize creds from session or create new
    let creds = session.creds && session.creds.me 
        ? session.creds 
        : initAuthCreds();

    // Initialize keys storage
    let keys = session.keys || {};

    /**
     * Save credentials to MongoDB
     * This is called automatically by Baileys when creds change
     */
    const saveCreds = async () => {
        try {
            // Get latest creds from authState
            const credsToSave = creds;
            
            // Ensure we have the me object before saving
            if (!credsToSave.me || !credsToSave.me.id) {
                console.warn(`[MongoAuth] Attempting to save incomplete creds for ${sessionId}`);
            }

            // Update session in database
            const updateData = {
                creds: credsToSave,
                keys: keys,
                updatedAt: new Date()
            };

            // Only update phoneNumber if it exists in creds.me
            if (credsToSave.me?.id) {
                const phoneFromCreds = credsToSave.me.id.split(':')[0];
                if (phoneFromCreds && phoneFromCreds.length >= 10) {
                    updateData.phoneNumber = phoneFromCreds;
                }
            }

            await Session.findOneAndUpdate(
                { sessionId },
                { $set: updateData },
                { new: true, upsert: true }
            );

            console.log(`[MongoAuth] ✅ Creds saved for ${sessionId}`);
            return true;
            
        } catch (error) {
            console.error(`[MongoAuth] ❌ Error saving creds for ${sessionId}:`, error.message);
            throw error;
        }
    };

    /**
     * Save keys to MongoDB
     * Baileys calls this when keys need to be persisted
     */
    const saveKeys = async (keyType, keysData) => {
        try {
            if (!keys[keyType]) {
                keys[keyType] = {};
            }
            
            // Merge new keys with existing
            Object.assign(keys[keyType], keysData);
            
            // Persist to database
            await Session.findOneAndUpdate(
                { sessionId },
                { $set: { keys, updatedAt: new Date() } },
                { new: true }
            );
            
            console.log(`[MongoAuth] 🔑 Keys saved (${keyType}): ${Object.keys(keysData).length} items`);
            return true;
            
        } catch (error) {
            console.error(`[MongoAuth] ❌ Error saving keys for ${sessionId}:`, error.message);
            throw error;
        }
    };

    /**
     * Get keys from storage
     */
    const getKey = async (type, ids) => {
        try {
            const keyType = `${type}Keys`;
            const sessionData = await Session.findOne({ sessionId });
            
            if (!sessionData || !sessionData.keys || !sessionData.keys[keyType]) {
                return {};
            }

            const result = {};
            for (const id of ids) {
                if (sessionData.keys[keyType][id]) {
                    // Deserialize BufferJSON if needed
                    result[id] = JSON.parse(
                        JSON.stringify(sessionData.keys[keyType][id]),
                        BufferJSON.reviver
                    );
                }
            }
            
            return result;
            
        } catch (error) {
            console.error(`[MongoAuth] ❌ Error getting keys for ${sessionId}:`, error.message);
            return {};
        }
    };

    /**
     * Set keys in storage
     */
    const setKey = async (type, keysData) => {
        try {
            const keyType = `${type}Keys`;
            
            if (!keys[keyType]) {
                keys[keyType] = {};
            }

            // Serialize keys for storage
            for (const [id, key] of Object.entries(keysData)) {
                keys[keyType][id] = JSON.parse(
                    JSON.stringify(key, BufferJSON.replacer)
                );
            }

            // Persist to database
            await Session.findOneAndUpdate(
                { sessionId },
                { $set: { keys, updatedAt: new Date() } },
                { new: true }
            );

            return true;
            
        } catch (error) {
            console.error(`[MongoAuth] ❌ Error setting keys for ${sessionId}:`, error.message);
            throw error;
        }
    };

    /**
     * Build the complete auth state object for Baileys
     */
    const authState = {
        state: {
            creds,
            keys: {
                get: getKey,
                set: setKey
            }
        },
        saveCreds
    };

    // Log initial state
    console.log(`[MongoAuth] 📦 Auth state initialized for ${sessionId}`);
    console.log(`[MongoAuth] 📊 Creds has me: ${!!creds.me}, me.id: ${creds.me?.id || 'N/A'}`);

    return authState;
}

module.exports = useMongoAuthState;

