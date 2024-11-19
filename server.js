const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const path = require('path');

//secret for JWT 
const JWT_SECRET = 'pet_adoption';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));


// Initialize database
// SQLite database setup
const db = new sqlite3.Database('./data/pet_adoption.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        contact_info TEXT,
        address TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        breed TEXT,
        age INTEGER,
        size TEXT,
        health_status TEXT,
        vaccination_details TEXT,
        image TEXT,
        status TEXT DEFAULT 'Available'
    )`);


    db.run(`CREATE TABLE IF NOT EXISTS adoption_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        pet_id INTEGER,
        reason TEXT,
        status TEXT DEFAULT 'Pending',
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(pet_id) REFERENCES pets(id)
    )`);
}


});

// User endpoints
app.post('/signup', async (req, res) => {
    const { email, username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, username, password) VALUES (?, ?, ?)', [email, username, hashedPassword], (err) => {
        if (err) {
            res.status(400).send({ message: 'Error creating account', error: err.message });
        } else {
            res.status(201).send({ message: 'Account created successfully' });
        }
    });
});

app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM ,users ,WHERE ,email = ?', [email], async (err, user) => {
        if (err) {
            res.status(500).send({ message: 'Error during sign-in', error: err.message });
        } else if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
            res.status(200).send({ message: 'Login successful', token });
        } else {
            res.status(401).send({ message: 'Invalid credentials' });
        }
    });
});

// Middleware for verifying JWT
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send({ message: 'Access Denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send({ message: 'Invalid Token' });
        req.user = user;
        next();
    });
}

// Pet endpoints
app.get('/pets', (req, res) => {
    db.all('SELECT * FROM pets', [], (err, rows) => {
        if (err) {
            res.status(500).send({ message: 'Error fetching pets', error: err.message });
        } else {
            res.status(200).send(rows);
        }
    });
});

app.get('/pets/:id', (req, res) => {
    const petId = req.params.id; // Extract the pet ID from the request parameters

    db.get('SELECT * FROM pets WHERE id = ?', [petId], (err, row) => {
        if (err) {
            console.error('Error fetching pet details:', err.message);
            res.status(500).send({ message: 'Error fetching pet details' });
        } else if (!row) {
            res.status(404).send({ message: 'Pet not found' });
        } else {
            res.status(200).send(row);
        }
    });
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