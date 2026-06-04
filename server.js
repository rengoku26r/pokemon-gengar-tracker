require('dotenv').config();
const pool = require('./db');
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const activeSessions = new Map();


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
        return res.status(400).json({
            error: 'All fields are required'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters'
        });
    }

    try {

        const existing = await pool.query(
            `
            SELECT id
            FROM users
            WHERE email=$1 OR username=$2
            `,
            [email.toLowerCase(), username]
        );

        if (existing.rows.length) {
            return res.status(409).json({
                error: 'Email or username already exists'
            });
        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const id = uuidv4();

        await pool.query(
            `
            INSERT INTO users
            (
                id,
                username,
                email,
                password
            )
            VALUES
            ($1,$2,$3,$4)
            `,
            [
                id,
                username,
                email.toLowerCase(),
                hashedPassword
            ]
        );

        const token = uuidv4();

        activeSessions.set(token, id);

        res.status(201).json({
            token,
            username,
            email
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

app.post('/api/auth/login', async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE email=$1
            `,
            [email.toLowerCase()]
        );

        if (!result.rows.length) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!valid) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const token = uuidv4();

        activeSessions.set(
            token,
            user.id
        );

        res.json({
            token,
            username: user.username,
            email: user.email
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

app.get('/api/user', authenticate, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT username,email
            FROM users
            WHERE id=$1
            `,
            [req.userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json(result.rows[0]);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

app.get('/api/progress', authenticate, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT progress
            FROM users
            WHERE id=$1
            `,
            [req.userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json({
            progress: result.rows[0].progress || {}
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

app.put('/api/progress', authenticate, async (req, res) => {

    const { episodeCode, watched } = req.body;

    try {

        const result = await pool.query(
            `
            SELECT progress
            FROM users
            WHERE id=$1
            `,
            [req.userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const progress =
            result.rows[0].progress || {};

        if (watched) {
            progress[episodeCode] = true;
        } else {
            delete progress[episodeCode];
        }

        await pool.query(
            `
            UPDATE users
            SET progress=$1
            WHERE id=$2
            `,
            [JSON.stringify(progress), req.userId]
        );

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

app.put('/api/progress/batch', authenticate, async (req, res) => {

    const { updates } = req.body;

    try {

        const result = await pool.query(
            `
            SELECT progress
            FROM users
            WHERE id=$1
            `,
            [req.userId]
        );

        const progress =
            result.rows[0].progress || {};

        updates.forEach(update => {

            if (update.watched) {
                progress[update.code] = true;
            } else {
                delete progress[update.code];
            }
        });

        await pool.query(
            `
            UPDATE users
            SET progress=$1
            WHERE id=$2
            `,
            [JSON.stringify(progress), req.userId]
        );

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

// =========================
// LINKS API
// =========================

app.get('/api/links', authenticate, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT links
            FROM users
            WHERE id=$1
            `,
            [req.userId]
        );

        res.json({
            links: result.rows[0].links || {}
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});


app.put('/api/links', authenticate, async (req, res) => {

    const { code, url } = req.body;

    try {

        const result = await pool.query(
            `
            SELECT links
            FROM users
            WHERE id=$1
            `,
            [req.userId]
        );

        const links =
            result.rows[0].links || {};

        if (url && url.trim()) {
            links[code] = url.trim();
        } else {
            delete links[code];
        }

        await pool.query(
            `
            UPDATE users
            SET links=$1
            WHERE id=$2
            `,
            [JSON.stringify(links), req.userId]
        );

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Pokemon Tracker running at http://localhost:${PORT}`);
});