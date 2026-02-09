const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    deviceId: String,
    linkedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    lastActive: Date,
    messageCount: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    spamCount: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    countryCode: String,
    joinedGroups: [String],
    mustFollowChannel: { type: Boolean, default: true },
    settings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

// Group Schema
const groupSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    settings: {
        antilink: { type: Boolean, default: true },
        antiporn: { type: Boolean, default: true },
        antiscam: { type: Boolean, default: true },
        antimedia: { type: String, default: 'off' },
        sleeping: { type: Boolean, default: false }
    },
    participants: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Channel Subscriber Schema (Feature 30)
const channelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    subscribedAt: { type: Date, default: Date.now },
    lastActive: Date,
    isActive: { type: Boolean, default: true },
    reactions: { type: Number, default: 0 },
    postsViewed: { type: Number, default: 0 }
});

// Message Log Schema
const messageLogSchema = new mongoose.Schema({
    type: String, // VIEW_ONCE, DELETED, SCAM, etc.
    from: String,
    chat: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
    actionTaken: String
});

// Create models
const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const ChannelSubscriber = mongoose.model('ChannelSubscriber', channelSubscriberSchema);
const MessageLog = mongoose.model('MessageLog', messageLogSchema);

module.exports = { User, Group, ChannelSubscriber, MessageLog };
