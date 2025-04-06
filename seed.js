// seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Message = require('./models/Message');
const Channel = require('./models/Channel');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);

    const exists = await User.findOne({ username: 'admin' });
    if (!exists) {
        const admin = new User({
            email: 'admin@neoirc.local',
            username: 'admin',
            password: await bcrypt.hash('adminpass', 10),
            role: 'admin',
            isOnline: false
        });
        await admin.save();

        await Channel.create({ name: 'general', description: 'Default global chat', createdBy: 'admin' });

        await Message.create({
            sender: '📢 SYSTEM',
            content: 'Welcome to Neo IRC!',
            isAnnouncement: true,
            channel: 'general'
        });

        console.log("✅ Default data seeded.");
    } else {
        console.log("⚠️ Admin already exists. Skipping seed.");
    }

    process.exit();
}

seed();
