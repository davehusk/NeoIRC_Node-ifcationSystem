const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'voiced', 'user'], default: 'user' },
  isOnline: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  bio: { type: String, default: '' } // ✅ Added
});

module.exports = mongoose.model('User', userSchema);
