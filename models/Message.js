const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
    isPrivate: { type: Boolean, default: false },
    to: String // for private messages
});

module.exports = mongoose.model('Message', messageSchema);
