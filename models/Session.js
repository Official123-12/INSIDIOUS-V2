const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  phoneNumber: { type: String, default: 'pending' },
  creds: { type: String, required: true },
  keys: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending, active, expired
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);