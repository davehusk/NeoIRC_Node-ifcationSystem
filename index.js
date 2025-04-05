const express = require('express');
const expressWs = require('express-ws');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');
const Message = require('./models/Message');

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

function requireAuth(req, res, next) {
    if (req.session.userId) return next();
    return res.redirect('/login');
}
function requireAdmin(req, res, next) {
    if (req.session.role === 'admin') return next();
    return res.status(403).send('Access Denied');
}

let clients = [];

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => console.log(`🚀 Server at http://localhost:${PORT}`));
});

app.ws('/ws', async (ws, req) => {
    const session = req.session;
    if (!session || !session.username) return ws.close();

    const user = await User.findById(session.userId);
    if (!user) return ws.close();

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    clients.push({ ws, userId: user._id });

    ws.on('close', async () => {
        clients = clients.filter(c => c.ws !== ws);
        const u = await User.findById(session.userId);
        if (u) {
            u.isOnline = false;
            u.lastActive = new Date();
            await u.save();
        }
    });
});

app.get('/', (req, res) => res.render('index'));
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
    if (exists) return res.render('signup', { error: 'Email/Username already used' });
    const user = new User({
        email, username, password: await bcrypt.hash(password, 10),
        role: username === 'admin' ? 'admin' : 'user',
        isOnline: true
    });
    await user.save();
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
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
    const users = await User.find({ username: { $ne: req.session.username } }).sort({ username: 1 });
    res.render('dashboard', {
        username: req.session.username,
        isAdmin: req.session.role === 'admin',
        users
    });
});

app.get('/admin', requireAuth, requireAdmin, async (req, res) => {
    const users = await User.find({}).sort({ username: 1 });
    res.render('admin', { users, isAdmin: true, username: req.session.username });
});
app.post('/send', requireAuth, async (req, res) => {
    const { message, to, fromAdmin } = req.body;
    const sender = fromAdmin ? 'ADMIN' : req.session.username;

    const msg = new Message({
        sender,
        content: message,
        isPrivate: !!to,
        to: to || null
    });
    await msg.save();

    const payload = {
        sender,
        content: message,
        timestamp: new Date().toLocaleString(),
        to: to || null
    };

    // Broadcast logic
    clients.forEach(client => {
        if (!to || (to && client.userId.toString() === to)) {
            client.ws.send(JSON.stringify(payload));
        }
    });

    res.sendStatus(200);
});


app.get('/messages', requireAuth, async (req, res) => {
    const messages = await Message.find({}).sort({ timestamp: -1 });
    res.render('messages', { messages, username: req.session.username });
});

app.get('/users', requireAuth, async (req, res) => {
    const users = await User.find({}).sort({ username: 1 });
    res.render('users', { users, username: req.session.username });
});

app.post('/users/:id/ban', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.role = 'banned';
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/unban', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.role = 'user';
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/delete', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    await user.remove();
    res.redirect('/admin');
});
app.post('/users/:id/online', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.isOnline = true;
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/offline', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.isOnline = false;
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/voiced', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.role = 'voiced';
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/unvoiced', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.role = 'user';
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/username', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.username = req.body.username;
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/email', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.email = req.body.email;
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/password', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.password = await bcrypt.hash(req.body.password, 10);
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.role = req.body.role;
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/online-status', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.isOnline = req.body.isOnline === 'true';
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/last-active', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.lastActive = new Date(req.body.lastActive);
    await user.save();
    res.redirect('/admin');
});
app.post('/users/:id/ban-status', requireAuth, requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    user.role = req.body.banStatus === 'true' ? 'banned' : 'user';
    await user.save();
    res.redirect('/admin');
});