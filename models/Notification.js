const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    username: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model('Notification', notificationSchema);
