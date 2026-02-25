const { MongoClient, ObjectId } = require('mongodb');

/**
 * Custom MongoDB Auth State for Baileys
 * Stores each user's session separately with unique sessionId
 */
async function useMongoAuthState(sessionId, mongoUri, dbName = 'whatsapp_sessions') {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db(dbName);
    const sessionsCollection = db.collection('sessions');
    const keysCollection = db.collection('session_keys');

    // Load or create session
    let sessionDoc = await sessionsCollection.findOne({ sessionId });
    
    if (!sessionDoc) {
        sessionDoc = {
            sessionId,
            creds: {},
            createdAt: new Date(),
            lastActive: new Date(),
            phoneNumber: null,
            status: 'pending' // pending, connected, disconnected
        };
        await sessionsCollection.insertOne(sessionDoc);
    }

    // Auth state object that Baileys expects
    const authState = {
        creds: sessionDoc.creds || {},
        keys: {
            get: async (type, ids) => {
                const keys = {};
                const results = await keysCollection.find({
                    sessionId,
                    type,
                    id: { $in: ids }
                }).toArray();
                
                results.forEach(key => {
                    keys[key.id] = key.key;
                });
                return keys;
            },
            set: async (data) => {
                const bulkOps = [];
                
                for (const [id, key] of Object.entries(data)) {
                    bulkOps.push({
                        updateOne: {
                            filter: { sessionId, type: Object.keys(data)[0], id },
                            update: { 
                                $set: { key, updatedAt: new Date() },
                                $setOnInsert: { sessionId, type: Object.keys(data)[0], id, createdAt: new Date() }
                            },
                            upsert: true
                        }
                    });
                }
                
                if (bulkOps.length > 0) {
                    await keysCollection.bulkWrite(bulkOps);
                }
            }
        }
    };

    // Save credentials to MongoDB
    const saveCreds = async () => {
        await sessionsCollection.updateOne(
            { sessionId },
            { 
                $set: { 
                    creds: authState.creds,
                    lastActive: new Date(),
                    status: 'connected'
                } 
            }
        );
    };

    // Cleanup on logout
    const clearSession = async () => {
        await sessionsCollection.deleteOne({ sessionId });
        await keysCollection.deleteMany({ sessionId });
    };

    return {
        state: authState,
        saveCreds,
        clearSession,
        client // Keep reference to close later
    };
}

module.exports = { useMongoAuthState };

