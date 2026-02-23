const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  creds: { type: mongoose.Schema.Types.Mixed, required: true },
  keys: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);