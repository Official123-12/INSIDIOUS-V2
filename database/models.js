const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    deviceId: String,
    linkedAt: Date,
    isActive: { type: Boolean, default: true },
    mustFollowChannel: { type: Boolean, default: true },
    lastPair: Date,
    messageCount: { type: Number, default: 0 },
    lastActive: Date
});

// Group Schema
const groupSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    participants: Number,
    admins: [String],
    settings: Object,
    joinedAt: Date,
    lastActive: Date
});

// Channel Subscriber Schema
const channelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    subscribedAt: Date,
    isActive: { type: Boolean, default: true },
    autoFollow: { type: Boolean, default: false },
    lastActive: Date,
    source: String
});

// Settings Schema
const settingsSchema = new mongoose.Schema({
    antilink: { type: Boolean, default: true },
    antiporn: { type: Boolean, default: true },
    antiscam: { type: Boolean, default: true },
    antimedia: { type: Boolean, default: false },
    antitag: { type: Boolean, default: true },
    antiviewonce: { type: Boolean, default: true },
    antidelete: { type: Boolean, default: true },
    sleepingMode: { type: Boolean, default: false },
    welcomeGoodbye: { type: Boolean, default: true },
    activeMembers: { type: Boolean, default: false },
    autoblockCountry: { type: Boolean, default: false },
    chatbot: { type: Boolean, default: true },
    autoStatus: { type: Boolean, default: true },
    autoRead: { type: Boolean, default: true },
    autoReact: { type: Boolean, default: true },
    autoSave: { type: Boolean, default: true },
    autoBio: { type: Boolean, default: true },
    anticall: { type: Boolean, default: true },
    downloadStatus: { type: Boolean, default: false },
    antispam: { type: Boolean, default: true },
    antibug: { type: Boolean, default: true },
    autoStatusReply: { type: Boolean, default: true },
    workMode: { type: String, default: 'public' },
    commandPrefix: { type: String, default: '.' },
    updatedAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const ChannelSubscriber = mongoose.model('ChannelSubscriber', channelSubscriberSchema);
const Settings = mongoose.model('Settings', settingsSchema);

module.exports = {
    User,
    Group,
    ChannelSubscriber,
    Settings
};
