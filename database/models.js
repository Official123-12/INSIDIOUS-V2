const mongoose = require('mongoose');

// USER SCHEMA
const UserSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    deviceId: String,
    linkedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    isFollowingChannel: { type: Boolean, default: false },
    messageCount: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    warnings: { type: Number, default: 0 },
    countryCode: String,
    isBlocked: { type: Boolean, default: false },
    blockedCountries: [String]
});

// GROUP SCHEMA
const GroupSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    participants: Number,
    admins: [String],
    joinedAt: { type: Date, default: Date.now },
    settings: {
        antilink: { type: Boolean, default: true },
        antiporn: { type: Boolean, default: true },
        antiscam: { type: Boolean, default: true },
        antimedia: { type: Boolean, default: false },
        antitag: { type: Boolean, default: true },
        antiviewonce: { type: Boolean, default: true },
        antidelete: { type: Boolean, default: true },
        sleepingMode: { type: Boolean, default: false },
        sleepStart: String,
        sleepEnd: String,
        welcomeGoodbye: { type: Boolean, default: true },
        activeMembers: { type: Boolean, default: false },
        autoblockCountry: { type: Boolean, default: false },
        blockedCountries: [String],
        chatbot: { type: Boolean, default: true },
        autoRead: { type: Boolean, default: true },
        autoReact: { type: Boolean, default: true },
        autoSave: { type: Boolean, default: false },
        autoBio: { type: Boolean, default: true },
        anticall: { type: Boolean, default: true },
        downloadStatus: { type: Boolean, default: false },
        antispam: { type: Boolean, default: true },
        antibug: { type: Boolean, default: true }
    },
    messageStats: {
        total: { type: Number, default: 0 },
        activeMembers: { type: Number, default: 0 },
        inactiveMembers: { type: Number, default: 0 }
    }
});

// CHANNEL SUBSCRIBER SCHEMA
const ChannelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    subscribedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    lastReacted: Date
});

// SETTINGS SCHEMA
const SettingsSchema = new mongoose.Schema({
    // Anti Features
    antilink: { type: Boolean, default: true },
    antiporn: { type: Boolean, default: true },
    antiscam: { type: Boolean, default: true },
    antimedia: { type: Boolean, default: false },
    antitag: { type: Boolean, default: true },
    antiviewonce: { type: Boolean, default: true },
    antidelete: { type: Boolean, default: true },
    
    // Sleeping Mode
    sleepingMode: { type: Boolean, default: false },
    sleepStart: { type: String, default: "22:00" },
    sleepEnd: { type: String, default: "06:00" },
    
    // Welcome & Goodbye
    welcomeGoodbye: { type: Boolean, default: true },
    
    // Active Members
    activeMembers: { type: Boolean, default: false },
    inactiveDays: { type: Number, default: 7 },
    
    // Autoblock Country
    autoblockCountry: { type: Boolean, default: false },
    blockedCountries: { type: [String], default: [] },
    
    // Chatbot
    chatbot: { type: Boolean, default: true },
    
    // Auto Features
    autoStatus: { type: Boolean, default: true },
    autoStatusView: { type: Boolean, default: true },
    autoStatusLike: { type: Boolean, default: true },
    autoStatusReply: { type: Boolean, default: true },
    autoRead: { type: Boolean, default: true },
    autoReact: { type: Boolean, default: true },
    autoSave: { type: Boolean, default: false },
    autoBio: { type: Boolean, default: true },
    
    // Anti Call
    anticall: { type: Boolean, default: true },
    
    // Download Status
    downloadStatus: { type: Boolean, default: false },
    
    // Anti Spam
    antispam: { type: Boolean, default: true },
    spamLimit: { type: Number, default: 10 },
    
    // Anti Bug
    antibug: { type: Boolean, default: true },
    
    // Work Mode
    workMode: { type: String, default: "public" },
    commandPrefix: { type: String, default: "." },
    
    // Channel Settings
    channelSubscription: { type: Boolean, default: true },
    channelJid: { type: String, default: "120363404317544295@newsletter" },
    groupJid: { type: String, default: "120363406549688641@g.us" },
    
    // Updated at
    updatedAt: { type: Date, default: Date.now }
});

// MESSAGE LOG SCHEMA
const MessageLogSchema = new mongoose.Schema({
    messageId: String,
    sender: String,
    content: String,
    type: String,
    timestamp: { type: Date, default: Date.now },
    groupJid: String
});

// Create models
const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const ChannelSubscriber = mongoose.model('ChannelSubscriber', ChannelSubscriberSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const MessageLog = mongoose.model('MessageLog', MessageLogSchema);

module.exports = {
    User,
    Group,
    ChannelSubscriber,
    Settings,
    MessageLog
};
