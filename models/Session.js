const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    sessionId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    phoneNumber: { 
        type: String, 
        required: true 
    },
    creds: { 
        type: mongoose.Schema.Types.Mixed, 
        default: {} 
    },
    keys: { 
        type: mongoose.Schema.Types.Mixed, 
        default: {} 
    },
    status: { 
        type: String, 
        enum: ['inactive', 'active', 'expired'], 
        default: 'inactive' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Update `updatedAt` before saving
SessionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Session', SessionSchema);