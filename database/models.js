// database/models.js
const mongoose = require('mongoose');
const { connectDB, isDBConnected } = require('./connection');

// Create schemas
const userSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: { type: String, default: 'Unknown' },
    pushname: { type: String },
    messageCount: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now },
    channelNotified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    warnings: { type: Number, default: 0 }
}, { timestamps: true });

const channelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: { type: String, default: 'Unknown' },
    subscribedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    autoFollow: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    source: { type: String, default: 'manual' }
}, { timestamps: true });

const groupSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: { type: String, default: 'Unknown Group' },
    description: { type: String },
    adminJids: [{ type: String }],
    memberCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    settings: {
        antilink: { type: Boolean, default: true },
        welcome: { type: Boolean, default: true },
        nsfw: { type: Boolean, default: false },
        commands: { type: Boolean, default: true }
    },
    joinedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

const settingsSchema = new mongoose.Schema({
    // Security
    antilink: { type: Boolean, default: true },
    antiporn: { type: Boolean, default: true },
    antiscam: { type: Boolean, default: true },
    antimedia: { type: String, default: 'off' }, // 'all', 'photo', 'video', 'sticker', 'audio', 'document', 'off'
    antitag: { type: Boolean, default: true },
    antispam: { type: Boolean, default: true },
    antibug: { type: Boolean, default: true },
    anticall: { type: Boolean, default: true },
    
    // Recovery
    antiviewonce: { type: Boolean, default: true },
    antidelete: { type: Boolean, default: true },
    
    // Automation
    workMode: { type: String, default: 'public' }, // 'public', 'private'
    autoRead: { type: Boolean, default: true },
    autoReact: { type: Boolean, default: true },
    autoSave: { type: Boolean, default: true },
    autoBio: { type: Boolean, default: true },
    autoTyping: { type: Boolean, default: true },
    chatbot: { type: Boolean, default: true },
    
    // Channel
    channelSubscription: { type: Boolean, default: true },
    autoReactChannel: { type: Boolean, default: true },
    
    // Status
    autoStatus: {
        view: { type: Boolean, default: true },
        like: { type: Boolean, default: true },
        reply: { type: Boolean, default: true },
        emoji: { type: String, default: '🥀' }
    },
    
    // Sleep mode
    sleepStart: { type: String, default: '22:00' },
    sleepEnd: { type: String, default: '06:00' },
    
    // Last updated
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Create models with connection check
function createModel(name, schema) {
    return mongoose.model(name, schema);
}

// Initialize models
const User = createModel('User', userSchema);
const ChannelSubscriber = createModel('ChannelSubscriber', channelSubscriberSchema);
const Group = createModel('Group', groupSchema);
const Settings = createModel('Settings', settingsSchema);

// Ensure database connection before operations
async function ensureConnection() {
    if (!isDBConnected()) {
        await connectDB();
    }
}

// Enhanced find functions with timeout
async function safeFindOne(model, query, options = {}) {
    try {
        await ensureConnection();
        
        return await model.findOne(query).maxTimeMS(5000).exec();
    } catch (error) {
        console.error(`Database error in ${model.modelName}.findOne:`, error.message);
        return null;
    }
}

async function safeFind(model, query = {}, options = {}) {
    try {
        await ensureConnection();
        
        return await model.find(query).maxTimeMS(5000).exec();
    } catch (error) {
        console.error(`Database error in ${model.modelName}.find:`, error.message);
        return [];
    }
}

async function safeCount(model, query = {}) {
    try {
        await ensureConnection();
        
        return await model.countDocuments(query).maxTimeMS(5000).exec();
    } catch (error) {
        console.error(`Database error in ${model.modelName}.count:`, error.message);
        return 0;
    }
}

async function safeUpdate(model, query, update, options = {}) {
    try {
        await ensureConnection();
        
        return await model.findOneAndUpdate(query, update, {
            new: true,
            upsert: options.upsert || false,
            maxTimeMS: 5000
        }).exec();
    } catch (error) {
        console.error(`Database error in ${model.modelName}.update:`, error.message);
        return null;
    }
}

async function safeCreate(model, data) {
    try {
        await ensureConnection();
        
        return await model.create(data);
    } catch (error) {
        console.error(`Database error in ${model.modelName}.create:`, error.message);
        return null;
    }
}

// Export enhanced models and functions
module.exports = {
    // Models
    User,
    ChannelSubscriber,
    Group,
    Settings,
    
    // Connection
    connectDB,
    isDBConnected,
    getConnection: () => mongoose.connection,
    closeDB: require('./connection').closeDB,
    
    // Safe operations
    safeFindOne,
    safeFind,
    safeCount,
    safeUpdate,
    safeCreate,
    
    // Direct mongoose for complex operations
    mongoose
};
