const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const activeSessions = new Map();

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const userId = activeSessions.get(token);
    if (!userId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = userId;
    req.token = token;
    next();
}

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const data = loadUsers();
    const existingEmail = data.users.find(u => u.email === email.toLowerCase());
    const existingUsername = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingEmail) {
        return res.status(409).json({ error: 'Email already registered' });
    }
    if (existingUsername) {
        return res.status(409).json({ error: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
        id: uuidv4(),
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        progress: {},
        links: {},
        createdAt: new Date().toISOString()
    };
    data.users.push(user);
    saveUsers(data);
    const token = uuidv4();
    activeSessions.set(token, user.id);
    res.status(201).json({ token, username: user.username, email: user.email });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    const data = loadUsers();
    const user = data.users.find(u => u.email === email.toLowerCase());
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = uuidv4();
    activeSessions.set(token, user.id);
    res.json({ token, username: user.username, email: user.email });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
    activeSessions.delete(req.token);
    res.json({ success: true });
});

app.get('/api/user', authenticate, (req, res) => {
    const data = loadUsers();
    const user = data.users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ username: user.username, email: user.email });
});

app.get('/api/progress', authenticate, (req, res) => {
    const data = loadUsers();
    const user = data.users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ progress: user.progress || {} });
});

app.put('/api/progress', authenticate, (req, res) => {
    const { episodeCode, watched } = req.body;
    if (!episodeCode) {
        return res.status(400).json({ error: 'Episode code is required' });
    }
    const data = loadUsers();
    const userIndex = data.users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    if (!data.users[userIndex].progress) {
        data.users[userIndex].progress = {};
    }
    if (watched) {
        data.users[userIndex].progress[episodeCode] = true;
    } else {
        delete data.users[userIndex].progress[episodeCode];
    }
    saveUsers(data);
    res.json({ success: true });
});

app.put('/api/progress/batch', authenticate, (req, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
        return res.status(400).json({ error: 'Updates must be an array' });
    }
    const data = loadUsers();
    const userIndex = data.users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    if (!data.users[userIndex].progress) {
        data.users[userIndex].progress = {};
    }
    updates.forEach(({ code, watched }) => {
        if (watched) {
            data.users[userIndex].progress[code] = true;
        } else {
            delete data.users[userIndex].progress[code];
        }
    });
    saveUsers(data);
    res.json({ success: true });
});

// =========================
// LINKS API
// =========================

app.get('/api/links', authenticate, (req, res) => {

    const data = loadUsers();

    const user = data.users.find(u => u.id === req.userId);

    if (!user) {
        return res.status(404).json({
            error: 'User not found'
        });
    }

    res.json({
        links: user.links || {}
    });
});


app.put('/api/links', authenticate, (req, res) => {

    const { code, url } = req.body;

    if (!code) {
        return res.status(400).json({
            error: 'Episode code required'
        });
    }

    const data = loadUsers();

    const userIndex = data.users.findIndex(
        u => u.id === req.userId
    );

    if (userIndex === -1) {
        return res.status(404).json({
            error: 'User not found'
        });
    }

    if (!data.users[userIndex].links) {
        data.users[userIndex].links = {};
    }

    if (url && url.trim()) {
        data.users[userIndex].links[code] = url.trim();
    } else {
        delete data.users[userIndex].links[code];
    }

    saveUsers(data);

    res.json({
        success: true
    });
});

app.listen(PORT, () => {
    console.log(`Pokemon Tracker running at http://localhost:${PORT}`);
});

console.log("redeploy test");