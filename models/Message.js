const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
    to: String,
    isPrivate: { type: Boolean, default: false },
    isAnnouncement: { type: Boolean, default: false },
    channel: { type: String, default: 'general' }
});

module.exports = mongoose.model('Message', messageSchema);
