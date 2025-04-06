// index.js (FULLY REPAIRED BACKEND)
const express = require('express');
const expressWs = require('express-ws');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');
const Message = require('./models/Message');
const Channel = require('./models/Channel');

const app = express();
expressWs(app);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

const clients = [];

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
});

app.ws('/ws', async (ws, req) => {
    const { userId, username } = req.session;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const channel = url.searchParams.get("channel") || "general";

    if (!userId || !username) return ws.close();
    const user = await User.findById(userId);
    if (!user) return ws.close();

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    clients.push({ ws, userId, username, channel });

    ws.on('close', async () => {
        clients.splice(clients.findIndex(c => c.ws === ws), 1);
        user.isOnline = false;
        user.lastActive = new Date();
        await user.save();
    });
});


function requireAuth(req, res, next) {
    if (req.session.userId) return next();
    return res.redirect('/login');
}
function requireAdmin(req, res, next) {
    if (req.session.role === 'admin') return next();
    return res.status(403).send('Access denied');
}

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.render('login', { error: 'Invalid credentials' });
    }
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.redirect('/dashboard');
});

app.get('/signup', (req, res) => res.render('signup', { error: null }));
app.post('/signup', async (req, res) => {
    const { email, username, password } = req.body;
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.render('signup', { error: 'Email or username exists' });
    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({ email, username, password: hash, role: username === 'admin' ? 'admin' : 'user' });
    await newUser.save();
    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    req.session.role = newUser.role;
    res.redirect('/dashboard');
});

app.post('/logout', async (req, res) => {
    const u = await User.findById(req.session.userId);
    if (u) {
        u.isOnline = false;
        u.lastActive = new Date();
        await u.save();
    }
    req.session.destroy(() => res.redirect('/'));
});

app.get('/dashboard', requireAuth, async (req, res) => {
    const currentChannel = req.query.channel || 'general';
    const users = await User.find({ username: { $ne: req.session.username } });
    const messages = await Message.find({
        channel: currentChannel,
        $or: [
            { isPrivate: false },
            { isPrivate: true, $or: [{ sender: req.session.username }, { to: req.session.username }] }
        ]
    }).sort({ timestamp: 1 });
    res.render('dashboard', {
        username: req.session.username,
        isAdmin: req.session.role === 'admin',
        currentChannel,
        users,
        messages
    });
});

app.get('/admin', requireAuth, requireAdmin, async (req, res) => {
    const users = await User.find();
    const announcements = await Message.find({ isAnnouncement: true }).sort({ timestamp: -1 });
    res.render('admin', {
        users,
        announcements,
        isAdmin: req.session.role === 'admin',
        username: req.session.username
    });
});


app.post('/send', requireAuth, async (req, res) => {
    const { message, to, fromAdmin, channel } = req.body;
    const sender = fromAdmin ? '📢 SYSTEM' : req.session.username;
    const isAnnouncement = !!fromAdmin;
    const isPrivate = !!to;

    const msg = new Message({
        sender,
        content: message,
        timestamp: new Date(),
        isPrivate,
        to: to || null,
        isAnnouncement,
        channel: channel || 'general'
    });

    await msg.save();

    const payload = {
        sender,
        content: message,
        timestamp: msg.timestamp.toLocaleString(),
        to: to || null,
        isAnnouncement,
        channel: channel || 'general'
    };

    clients.forEach(client => {
        const matchPrivate = !to || client.username === sender || client.username === to;
        const matchChannel = client.channel === payload.channel;

        if (matchPrivate && matchChannel) {
            client.ws.send(JSON.stringify(payload));
        }
    });

    res.sendStatus(200);
});


app.get('/channels', requireAuth, async (req, res) => {
    const channels = await Channel.find({});
    res.render('channels', {
        channels,
        isAdmin: req.session.role === 'admin',
        username: req.session.username
    });
});

app.post('/channels/create', requireAuth, async (req, res) => {
    const { name, description } = req.body;
    const newChannel = new Channel({ name, description, createdBy: req.session.username });
    await newChannel.save();
    res.redirect('/channels');
});

app.post('/channels/delete', requireAuth, requireAdmin, async (req, res) => {
    const { name } = req.body;
    await Channel.deleteOne({ name });
    await Message.deleteMany({ channel: name });
    res.redirect('/channels');
});

app.post('/channels/update', requireAuth, requireAdmin, async (req, res) => {
    const { name, newName, description } = req.body;
    await Channel.updateOne({ name }, { name: newName, description });
    res.redirect('/channels');
});