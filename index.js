const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const User = require('./models/User');
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const app = express();
expressWs(app);
const Notification = require('./models/Notification');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'realtime-notifications-secret',
    resave: false,
    saveUninitialized: false
}));

let connectedClients = [];

app.ws('/ws', (socket, request) => {
    connectedClients.push(socket);

    socket.on('close', () => {
        connectedClients = connectedClients.filter(client => client !== socket);
    });
});

// Middleware to protect authenticated routes
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ $or: [{ email }, { username: email }] });
    if (!user) {
        return res.send("Invalid email or password");
    }
    // Set the isAdmin property based on the username
    req.session.isAdmin = user.username === 'admin'; // super simple for now
    // Check if the password is correct
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user._id;
        req.session.username = user.username;
        res.redirect("/dashboard");
    } else {
        res.send("Invalid email or password");
    }
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const { email, username, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
        return res.send("Email already registered. Try logging in.");
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ email, username, password: hashed });
    await newUser.save();

    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    req.session.isAdmin = username === 'admin';
    res.redirect("/dashboard");
});


app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.get("/dashboard", requireAuth, async (req, res) => {
    const notifications = await Notification.find().sort({ timestamp: -1 }).limit(50);
    res.render("dashboard", {
        username: req.session.username,
        isAdmin: req.session.isAdmin,
        notifications
    });
});


// POST a new notification
app.post('/send', requireAuth, async (req, res) => {
    const { message } = req.body;

    const now = new Date(); // This is what Mongoose expects
    const data = {
        username: req.session.username,
        message,
        timestamp: now
    };

    await Notification.create(data);

    // Broadcast formatted message (we can convert timestamp to string *after* storing)
    const payload = {
        username: data.username,
        message: data.message,
        timestamp: now.toLocaleString() // readable string for clients
    };

    connectedClients.forEach(socket => socket.send(JSON.stringify(payload)));
    res.sendStatus(200);
});



mongoose.connect(MONGO_URI)
    .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
    .catch((err) => console.error('MongoDB connection error:', err));
