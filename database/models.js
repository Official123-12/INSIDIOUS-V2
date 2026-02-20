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

// ==================== MESSAGE SCHEMA ====================
const MessageSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    jid: { type: String, required: true, index: true },
    fromMe: { type: Boolean, default: false },
    type: { type: String, enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'other'] },
    content: { type: mongoose.Schema.Types.Mixed },
    caption: { type: String },
    timestamp: { type: Date, default: Date.now },
    isGroup: { type: Boolean, default: false },
    groupJid: { type: String, index: true },
    quotedMessageId: { type: String }
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

// ==================== INDEXES ====================
UserSchema.index({ lastActive: -1 });
UserSchema.index({ messageCount: -1 });
GroupSchema.index({ participants: -1 });
SessionSchema.index({ lastActive: -1 });
MessageSchema.index({ timestamp: -1 });
MessageSchema.index({ jid: 1, timestamp: -1 });

// ==================== CREATE MODELS ====================
const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Session = mongoose.model('Session', SessionSchema);
const Message = mongoose.model('Message', MessageSchema);
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

User.getStats = async function() {
    try {
        const total = await this.countDocuments();
        const active = await this.countDocuments({ lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
        const blocked = await this.countDocuments({ isBlocked: true });
        const owners = await this.countDocuments({ isOwner: true });
        const paired = await this.countDocuments({ isPaired: true });
        return { total, active, blocked, owners, paired };
    } catch (error) { console.error('Error getting user stats:', error); return { total: 0, active: 0, blocked: 0, owners: 0, paired: 0 }; }
};

Group.findOrCreate = async function(jid, name = 'Unknown Group') {
    try {
        let group = await this.findOne({ jid });
        if (!group) group = await this.create({ jid, name, joinedAt: new Date() });
        return group;
    } catch (error) { console.error('Error in findOrCreate group:', error); return null; }
};

Group.updateParticipants = async function(jid, participants, admins = []) {
    try {
        await this.findOneAndUpdate({ jid }, { $set: { participants, admins, updatedAt: new Date() } });
    } catch (error) { console.error('Error updating group participants:', error); }
};

Group.getStats = async function() {
    try {
        const total = await this.countDocuments();
        const withAdmins = await this.countDocuments({ admins: { $ne: [] } });
        return { total, withAdmins };
    } catch (error) { console.error('Error getting group stats:', error); return { total: 0, withAdmins: 0 }; }
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

Session.getActiveSessions = async function() {
    try {
        return await this.find({ isActive: true, lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }).sort({ lastActive: -1 });
    } catch (error) { console.error('Error getting active sessions:', error); return []; }
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

CommandStats.incrementCommand = async function(command, userId) {
    try {
        const stat = await this.findOne({ command });
        if (stat) {
            stat.count += 1;
            stat.lastUsed = new Date();
            if (!stat.users.includes(userId)) stat.users.push(userId);
            await stat.save();
            return stat;
        } else {
            return await this.create({ command, count: 1, lastUsed: new Date(), users: [userId] });
        }
    } catch (error) { console.error('Error incrementing command stats:', error); return null; }
};

CommandStats.getTopCommands = async function(limit = 10) {
    try { return await this.find().sort({ count: -1 }).limit(limit); } 
    catch (error) { console.error('Error getting top commands:', error); return []; }
};

Ban.banUser = async function(jid, reason = 'No reason provided', bannedBy = 'system', days = null) {
    try {
        const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
        return await this.findOneAndUpdate({ jid }, { $set: { reason, bannedBy, bannedAt: new Date(), expiresAt, isPermanent: !days } }, { upsert: true, new: true });
    } catch (error) { console.error('Error banning user:', error); return null; }
};

Ban.unbanUser = async function(jid) {
    try { return await this.deleteOne({ jid }); } 
    catch (error) { console.error('Error unbanning user:', error); return null; }
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
module.exports = { User, Group, Settings, Session, Message, Ban, CommandStats };