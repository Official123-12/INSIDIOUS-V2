const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    phoneNumber: {
        type: String,
        required: false,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'expired', 'pending'],
        default: 'pending'
    },
    creds: {
        type: Object,
        default: null
    },
    // Baileys keys for encryption/decryption
    keys: {
        type: Object,
        default: null
    },
    // Timestamps for tracking
    lastPaired: {
        type: Date,
        default: null
    },
    lastConnected: {
        type: Date,
        default: null
    },
    lastDeployed: {
        type: Date,
        default: null
    },
    lastDisconnected: {
        type: Date,
        default: null
    },
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    strict: false // Allow flexible schema for creds/keys objects
});

// Index for faster lookups
SessionSchema.index({ sessionId: 1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ phoneNumber: 1 });

// Update the updatedAt field on save
SessionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Method to check if session is valid
SessionSchema.methods.isValid = function() {
    return this.creds && 
           this.creds.me && 
           this.creds.me.id && 
           this.status !== 'expired';
};

// Static method to find valid sessions
SessionSchema.statics.findValid = function() {
    return this.find({
        status: { $in: ['active', 'inactive'] },
        'creds.me.id': { $exists: true }
    });
};

module.exports = mongoose.model('Session', SessionSchema);

