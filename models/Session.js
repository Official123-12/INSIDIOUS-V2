const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  _id: String,
  creds: { type: mongoose.Schema.Types.Mixed, default: {} },
  keys: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

module.exports = mongoose.model('Session', SessionSchema);