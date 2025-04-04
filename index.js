const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');

const PORT = 3000;
//TODO: Replace with the URI pointing to your own MongoDB setup
const MONGO_URI = 'mongodb://localhost:27017/realtime_chat';
const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'realtime-notifications-secret',
    resave: false,
    saveUninitialized: true
}));

let connectedClients = [];

//Note: These are (probably) not all the required routes, nor are the ones present all completed.
//But they are a decent starting point for the routes you'll probably need

app.ws('/ws', (socket, request) => {
    socket.on('close', () => {
        
    });
});

// GET /login - Render login form
app.get("/login", (request, response) => {
    response.render("login");
});

// GET /signup - Render signup form
app.get("/signup", (request, response) => {
    response.render("signup");
});

// GET / - Render index page
app.get("/", (request, response) => {
    response.render("index");
});

// POST /logout - Log the user out of the site
app.post('/logout', (request, response) => {

});

mongoose.connect(MONGO_URI)
    .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
    .catch((err) => console.error('MongoDB connection error:', err));
