const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const db = new sqlite3.Database('./database/pets.db');
const path = require('path');


// Initialize database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER,
        breed TEXT,
        status TEXT CHECK(status IN ('Available', 'Adopted', 'Fostered')),
        description TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user'
    )`);
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve the frontend index.html at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Serve the admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// CRUD operations for pets
app.post('/api/pets', (req, res) => {
    const { name, age, breed, status, description } = req.body;
    db.run(`INSERT INTO pets (name, age, breed, status, description) VALUES (?, ?, ?, ?, ?)`,
        [name, age, breed, status, description], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID });
        });
});

app.get('/api/pets', (req, res) => {
    db.all(`SELECT * FROM pets`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/pets/:id', (req, res) => {
    const { name, age, breed, status, description } = req.body;
    db.run(`UPDATE pets SET name = ?, age = ?, breed = ?, status = ?, description = ? WHERE id = ?`,
        [name, age, breed, status, description, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        });
});

app.delete('/api/pets/:id', (req, res) => {
    db.run(`DELETE FROM pets WHERE id = ?`, req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// User authentication (simple example)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) res.json({ success: true, role: user.role });
        else res.status(401).json({ success: false, message: 'Invalid credentials' });
    });
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});