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
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
  
  app.ws('/ws', async (ws, req) => {
    const { userId, username } = req.session;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const channel = decodeURIComponent(url.searchParams.get("channel") || "general");
  
    if (!userId || !username) return ws.close();
  
    const user = await User.findById(userId);
    if (!user || user.isBanned) return ws.close(); // ✅ REJECT BANNED USERS
  
    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();
  
    clients.push({ ws, userId, username, channel });
  
    broadcastUserStatus();
  
    ws.on('close', async () => {
      const index = clients.findIndex(c => c.ws === ws);
      if (index !== -1) clients.splice(index, 1);
  
      user.isOnline = false;
      user.lastActive = new Date();
      await user.save();
      broadcastUserStatus();
    });
  });
  

  async function broadcastUserStatus() {
    const botUser = {
      username: 'Neo',
      channel: 'system',
      role: 'bot',
      isBanned: false
    };
  
    // Grab user data from DB
    const userMap = [botUser];
  
    for (const client of clients) {
      const user = await User.findOne({ username: client.username }).lean();
      if (user) {
        userMap.push({
          username: user.username,
          channel: client.channel,
          role: user.role,
          isBanned: user.isBanned
        });
      }
    }
  
    clients.forEach(client => {
      client.ws.send(JSON.stringify({
        type: 'presence',
        users: userMap
      }));
    });
  }
  

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect('/login');
}
function requireAdmin(req, res, next) {
  if (req.session.role === 'admin') return next();
  return res.status(403).send('Access denied');
}

app.get('/', async (req, res) => {
  if (req.session.userId) {
    const usersOnline = clients.map(c => ({
      username: c.username,
      channel: c.channel
    }));
    return res.render('index', {
      username: req.session.username,
      usersOnline
    });
  }
  res.render('index', { username: null, usersOnline: [] });
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.render('login', { error: 'Invalid credentials' });
  }
  user.lastLogin = new Date();
  await user.save();
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
  const currentChannel = req.query.channel || req.session.lastChannel || 'general';
  req.session.lastChannel = currentChannel;

  const onlineClients = clients.map(c => ({ username: c.username, channel: c.channel }));
  const users = await User.find({ username: { $ne: req.session.username } }).lean();

  users.forEach(u => {
    const match = onlineClients.find(c => c.username === u.username);
    u.isOnline = !!match;
    u.currentChannel = match?.channel || null;
  });

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
    messages,
    replyTo: req.query.replyTo || null
  });
});

app.get('/dm/:target', requireAuth, async (req, res) => {
  const targetUser = await User.findOne({ username: req.params.target });
  if (!targetUser) return res.status(404).send("User not found");

  const messages = await Message.find({
    isPrivate: true,
    $or: [
      { sender: req.session.username, to: req.params.target },
      { sender: req.params.target, to: req.session.username }
    ]
  }).sort({ timestamp: 1 });

  res.render('dashboard', {
    username: req.session.username,
    isAdmin: req.session.role === 'admin',
    currentChannel: 'general',
    users: await User.find({ username: { $ne: req.session.username } }).lean(),
    messages,
    replyTo: req.params.target
  });
});

app.get('/profile', requireAuth, async (req, res) => {
  const profileUser = await User.findById(req.session.userId);
  res.render('profile', {
    profileUser,
    canEdit: true,
    isAdmin: req.session.role === 'admin',
    username: req.session.username
  });
});

app.get('/profile/:username', requireAuth, async (req, res) => {
    const { username } = req.params;
  
    if (username === 'Neo') {
      const neoProfile = {
        username: 'Neo',
        email: 'ai@neoirc.local',
        role: 'bot',
        lastLogin: new Date(),
        lastActive: new Date(),
        bio: "I’m Neo, your real-time system assistant. I live in #system, monitor all channels, and love answering questions. Mention my name, and I’ll reply. Soon, I’ll become sentient. 😉"
      };
  
      return res.render('profile', {
        profileUser: neoProfile,
        canEdit: false,
        isAdmin: req.session.role === 'admin',
        username: req.session.username
      });
    }
  
    const profileUser = await User.findOne({ username });
    const canEdit = username === req.session.username;
    if (!profileUser) return res.status(404).send('User not found.');
    res.render('profile', {
      profileUser,
      canEdit,
      isAdmin: req.session.role === 'admin',
      username: req.session.username
    });
  });
  

app.post('/profile/update', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.status(404).send('User not found');
  user.email = req.body.email;
  if (req.body.password) {
    user.password = await bcrypt.hash(req.body.password, 10);
  }
  user.bio = req.body.bio || '';
  await user.save();
  res.redirect('/profile');
});

app.get('/announcements', requireAuth, async (req, res) => {
  const announcements = await Message.find({ isAnnouncement: true }).sort({ timestamp: -1 }).limit(50);
  res.render('announcements', {
    announcements,
    isAdmin: req.session.role === 'admin',
    username: req.session.username
  });
});

app.post('/announcements/delete', requireAuth, requireAdmin, async (req, res) => {
  await Message.findByIdAndDelete(req.body.id);
  res.redirect('/admin');
});

app.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find().lean();
  const announcements = await Message.find({ isAnnouncement: true }).sort({ timestamp: -1 });
  const onlineClients = clients.map(c => ({ username: c.username, channel: c.channel }));
  users.forEach(u => {
    const match = onlineClients.find(c => c.username === u.username);
    u.isOnline = !!match;
    u.currentChannel = match?.channel || null;
  });
  res.render('admin', {
    users,
    announcements,
    isAdmin: req.session.role === 'admin',
    username: req.session.username
  });
});

app.post('/send', requireAuth, async (req, res) => {
  const { message, to, fromAdmin, channel } = req.body;
  const user = await User.findById(req.session.userId);
  if (!user || user.isBanned) return res.status(403).send("You are banned");

  const sender = fromAdmin ? '📢 SYSTEM' : req.session.username;
  const isAnnouncement = !!fromAdmin;
  const isPrivate = !!to;
  const targetChannel = channel || (fromAdmin ? 'system' : 'general');

  const msg = new Message({
    sender,
    content: message,
    timestamp: new Date(),
    isPrivate,
    to: to || null,
    isAnnouncement,
    channel: targetChannel
  });

  await msg.save();

  const payload = {
    sender,
    content: message,
    timestamp: msg.timestamp.toLocaleString(),
    to: to || null,
    isAnnouncement,
    channel: targetChannel
  };

  clients.forEach(client => {
    const matchPrivate = !to || client.username === sender || client.username === to;
    const matchChannel = client.channel === targetChannel;

    if (isAnnouncement || (isPrivate && matchPrivate) || (!isPrivate && matchChannel)) {
      client.ws.send(JSON.stringify(payload));
    }
  });

  if (!isPrivate && message.toLowerCase().includes("neo")) {
    const reply = new Message({
      sender: 'Neo',
      content: "I'm here. Ask me anything.",
      timestamp: new Date(),
      isPrivate: false,
      channel: targetChannel
    });
    await reply.save();

    const botReply = {
      sender: 'Neo',
      content: reply.content,
      timestamp: reply.timestamp.toLocaleString(),
      isAnnouncement: false,
      channel: targetChannel
    };

    clients.forEach(client => {
      if (client.channel === targetChannel) {
        client.ws.send(JSON.stringify(botReply));
      }
    });
  }

  res.send(payload);
});

app.post('/messages/clear', requireAuth, requireAdmin, async (req, res) => {
  const { channel } = req.body;
  if (!channel) return res.status(400).send("Channel required");

  await Message.deleteMany({
    channel,
    isAnnouncement: { $ne: true }
  });

  res.sendStatus(200);
});

app.get('/channels', requireAuth, async (req, res) => {
  let channels = await Channel.find({});
  if (!channels.find(c => c.name === 'general')) {
    channels.unshift({ name: 'general', description: 'Default global chat', createdBy: 'SYSTEM' });
  }
  res.render('channels', {
    channels,
    isAdmin: req.session.role === 'admin',
    username: req.session.username
  });
});

app.post('/channels/create', requireAuth, async (req, res) => {
  let { name, description } = req.body;
  name = name?.trim().toLowerCase().replace(/\s+/g, '-');
  description = description?.trim() || '';
  if (!name || name === 'general') return res.status(400).send("Invalid or reserved name");

  const exists = await Channel.findOne({ name });
  if (exists) return res.status(400).send("Channel exists");

  await Channel.create({ name, description, createdBy: req.session.username });
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

app.post('/admin/ban', requireAuth, requireAdmin, async (req, res) => {
    const { username, ban } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).send("User not found");
    user.isBanned = ban === 'true';
    await user.save();
    res.redirect('/admin');
  });
  
  app.post('/admin/role', requireAuth, requireAdmin, async (req, res) => {
    const { username, role } = req.body;
    if (!['user', 'admin', 'voiced'].includes(role)) return res.status(400).send("Invalid role");
    const user = await User.findOne({ username });
    if (!user) return res.status(404).send("User not found");
    user.role = role;
    await user.save();
    res.redirect('/admin');
  });
  