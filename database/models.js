const mongoose = require('mongoose');

// ==================== USER SCHEMA ====================
const UserSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'Unknown' },
    deviceId: { type: String },
    linkedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    isFollowingChannel: { type: Boolean, default: false },
    messageCount: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    warnings: { type: Number, default: 0 },
    countryCode: { type: String },
    isBlocked: { type: Boolean, default: false },
    isOwner: { type: Boolean, default: false },
    isPaired: { type: Boolean, default: false }
}, { timestamps: true });

// ==================== GROUP SCHEMA ====================
const GroupSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'Unknown Group' },
    participants: { type: Number, default: 0 },
    admins: [{ type: String }],
    joinedAt: { type: Date, default: Date.now },
    settings: {
        antilink: { type: Boolean, default: true },
        antiporn: { type: Boolean, default: true },
        antiscam: { type: Boolean, default: true },
        antimedia: { type: Boolean, default: false },
        antitag: { type: Boolean, default: true },
        antiviewonce: { type: Boolean, default: true },
        antidelete: { type: Boolean, default: true },
        welcomeGoodbye: { type: Boolean, default: true },
        chatbot: { type: Boolean, default: true }
    },
    welcomeMessage: { type: String, default: 'Welcome to the group! 🎉' },
    goodbyeMessage: { type: String, default: 'Goodbye! 👋' }
}, { timestamps: true });

// ==================== SETTINGS SCHEMA ====================
const SettingsSchema = new mongoose.Schema({
    antilink: { type: Boolean, default: true },
    antiporn: { type: Boolean, default: true },
    antiscam: { type: Boolean, default: true },
    antimedia: { type: Boolean, default: false },
    antitag: { type: Boolean, default: true },
    antiviewonce: { type: Boolean, default: true },
    antidelete: { type: Boolean, default: true },
    sleepingMode: { type: Boolean, default: false },
    welcomeGoodbye: { type: Boolean, default: true },
    chatbot: { type: Boolean, default: true },
    autoRead: { type: Boolean, default: true },
    autoReact: { type: Boolean, default: true },
    autoBio: { type: Boolean, default: true },
    anticall: { type: Boolean, default: true },
    antispam: { type: Boolean, default: true },
    antibug: { type: Boolean, default: true },
    prefix: { type: String, default: '.' },
    botName: { type: String, default: 'INSIDIOUS' },
    workMode: { type: String, enum: ['public', 'private', 'inbox', 'groups'], default: 'public' },
    ownerNumbers: [{ type: String }],
    botSecretId: { type: String, unique: true, sparse: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ==================== SESSION SCHEMA ====================
const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    sessionData: { type: mongoose.Schema.Types.Mixed, default: {} },
    creds: { type: mongoose.Schema.Types.Mixed, default: {} },
    keys: { type: mongoose.Schema.Types.Mixed, default: {} },
    number: { type: String, index: true },
    deviceId: { type: String },
    platform: { type: String, default: 'WhatsApp' },
    lastActive: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ==================== BAN SCHEMA ====================
const BanSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: 'No reason provided' },
    bannedBy: { type: String },
    bannedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    isPermanent: { type: Boolean, default: false }
});

// ==================== COMMAND STATS SCHEMA ====================
const CommandStatsSchema = new mongoose.Schema({
    command: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    lastUsed: { type: Date, default: Date.now },
    users: [{ type: String }]
}, { timestamps: true });

// ==================== CREATE MODELS ====================
const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Session = mongoose.model('Session', SessionSchema);
const Ban = mongoose.model('Ban', BanSchema);
const CommandStats = mongoose.model('CommandStats', CommandStatsSchema);

// ==================== HELPER FUNCTIONS ====================
User.findOrCreate = async function(jid, name = 'Unknown') {
    try {
        let user = await this.findOne({ jid });
        if (!user) user = await this.create({ jid, name, linkedAt: new Date(), lastActive: new Date() });
        return user;
    } catch (error) { console.error('Error in findOrCreate user:', error); return null; }
};

User.updateActivity = async function(jid) {
    try {
        await this.findOneAndUpdate({ jid }, { $set: { lastActive: new Date() }, $inc: { messageCount: 1 } });
    } catch (error) { console.error('Error updating user activity:', error); }
};

Group.findOrCreate = async function(jid, name = 'Unknown Group') {
    try {
        let group = await this.findOne({ jid });
        if (!group) group = await this.create({ jid, name, joinedAt: new Date() });
        return group;
    } catch (error) { console.error('Error in findOrCreate group:', error); return null; }
};

Session.saveSession = async function(sessionId, creds, keys = {}, extra = {}) {
    try {
        return await this.findOneAndUpdate({ sessionId }, { $set: { creds, keys, ...extra, updatedAt: new Date() } }, { upsert: true, new: true });
    } catch (error) { console.error('Error saving session:', error); return null; }
};

Session.loadSession = async function(sessionId) {
    try { return await this.findOne({ sessionId }); } 
    catch (error) { console.error('Error loading session:', error); return null; }
};

Session.deleteSession = async function(sessionId) {
    try { return await this.deleteOne({ sessionId }); } 
    catch (error) { console.error('Error deleting session:', error); return null; }
};

Settings.getSettings = async function() {
    try {
        let settings = await this.findOne();
        if (!settings) settings = await this.create({});
        return settings;
    } catch (error) { console.error('Error getting settings:', error); return null; }
};

Settings.updateSettings = async function(updates) {
    try { return await this.findOneAndUpdate({}, { $set: updates }, { upsert: true, new: true }); } 
    catch (error) { console.error('Error updating settings:', error); return null; }
};

Ban.isBanned = async function(jid) {
    try {
        const ban = await this.findOne({ jid });
        if (!ban) return false;
        if (ban.expiresAt && ban.expiresAt < new Date()) {
            await this.deleteOne({ jid });
            return false;
        }
        return true;
    } catch (error) { console.error('Error checking ban status:', error); return false; }
};

// ==================== EXPORT MODELS ====================
module.exports = { User, Group, Settings, Session, Ban, CommandStats };