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
    sessionData: mongoose.Schema.Types.Mixed,
    settings: {
        antilink: { type: Boolean, default: true },
        antiporn: { type: Boolean, default: true },
        antiscam: { type: Boolean, default: true },
        chatbot: { type: Boolean, default: true }
    }
});

// Session Schema
const sessionSchema = new mongoose.Schema({
    pairingCode: { type: String, unique: true },
    number: String,
    status: { type: String, enum: ['pending', 'completed', 'expired'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    completedAt: { type: Date },
    userId: mongoose.Schema.Types.ObjectId
});

// Channel Subscriber Schema
const channelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    subscribedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    reactionsGiven: { type: Number, default: 0 },
    postsViewed: { type: Number, default: 0 }
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
        antitag: { type: Boolean, default: true },
        sleeping: { type: Boolean, default: false },
        welcome: { type: Boolean, default: true },
        goodbye: { type: Boolean, default: true }
    },
    sleepingMode: {
        enabled: Boolean,
        start: String,
        end: String
    }
});

// Message Log Schema
const messageLogSchema = new mongoose.Schema({
    type: String,
    from: String,
    chat: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
    actionTaken: String
});

// Create models
const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);
const ChannelSubscriber = mongoose.model('ChannelSubscriber', channelSubscriberSchema);
const Group = mongoose.model('Group', groupSchema);
const MessageLog = mongoose.model('MessageLog', messageLogSchema);

// Auto-expire sessions
setInterval(async () => {
    try {
        const expired = await Session.deleteMany({
            status: 'pending',
            expiresAt: { $lt: new Date() }
        });
        if (expired.deletedCount > 0) {
            console.log(`Cleaned ${expired.deletedCount} expired sessions`);
        }
    } catch (error) {
        console.error("Session cleanup error:", error);
    }
}, 60000);

module.exports = { User, Session, ChannelSubscriber, Group, MessageLog };