
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;

// Secret for JWT
const JWT_SECRET = 'your_jwt_secret';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

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
            status TEXT DEFAULT 'Available',
            Description Text
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
    db.run(`INSERT INTO users (email, username, password,name,contact_info,address) VALUES (?, ?, ?, ?, ?,?)`, [email, username, hashedPassword], (err) => {
        if (err) {
            res.status(400).send({ message: 'Error creating account', error: err.message });
        } else {
            res.status(201).send({ message: 'Account created successfully' });
        }
    });
});

app.post('/signin', (req, res) => {
    const { email, password } = req.body;

    // Query the database for the user by email
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            res.status(500).send({ message: 'Error during sign-in', error: err.message });
        } else if (user && await bcrypt.compare(password, user.password)) {
            // Generate a JWT token for the user
            const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });

            // Send the token and user_id in the response
            res.status(200).send({
                message: 'Login successful',
                token: token,      // JWT token
                user_id: user.id   // Include the user_id
                
            });
        } else {
            res.status(401).send({ message: 'Invalid credentials' });
        }
    });
});


// Middleware for verifying JWT
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        console.error('No token provided');
        return res.status(401).send({ message: 'Access Denied' });
    }

    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, user) => { // Ensure "Bearer <token>" is split
        if (err) {
            console.error('Invalid Token:', err.message);
            return res.status(403).send({ message: 'Invalid Token' });
        }
        req.user = user;
        next();
    });
}


// Pet endpoints
app.get('/pets', (req, res) => {
    db.all(`SELECT * FROM pets`, [], (err, rows) => {
        if (err) {
            res.status(500).send({ message: 'Error fetching pets', error: err.message });
        } else {
            res.status(200).send(rows);
        }
    });
});

app.get('/pets/:id', (req, res) => {
    const petId = req.params.id; // Extract the pet ID from the request parameters

    db.get(`SELECT * FROM pets WHERE id = ?`, [petId], (err, row) => {
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

app.post('/add-pet', authenticateToken, (req, res) => {
    console.log('Request received:', req.body);
    console.log('Authenticated user:', req.user);

    const { name, breed, age, size, health_status, vaccination_details, image, description } = req.body;
    if (!name || !breed || !age || !size || !health_status || !vaccination_details || !image || !description) {
        return res.status(400).send({ message: 'All fields are required.' });
    }

    db.run(
        `INSERT INTO pets (name, breed, age, size, health_status, vaccination_details, image, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, breed, age, size, health_status, vaccination_details, image, description],
        (err) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).send({ message: 'Failed to add pet.' });
            }
            res.status(201).send({ message: 'Pet added successfully!' });
        }
    );
});


app.put('/update-pet/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, breed, age, size, health_status, vaccination_details, image, status } = req.body;
    db.run(`UPDATE pets SET name = ?, breed = ?, age = ?, size = ?, health_status = ?, vaccination_details = ?, image = ?, status = ? WHERE id = ?, Description=?`,
        [name, breed, age, size, health_status, vaccination_details, image, status, id,Description], (err) => {
            if (err) {
                res.status(400).send({ message: 'Error updating pet', error: err.message });
            } else {
                res.status(200).send({ message: 'Pet updated successfully' });
            }
        });
});

app.delete('/delete-pet/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM pets WHERE id = ?`, [id], (err) => {
        if (err) {
            res.status(400).send({ message: 'Error deleting pet', error: err.message });
        } else {
            res.status(200).send({ message: 'Pet deleted successfully' });
        }
    });
});

// Add Adoption Request
app.post('/adopt', (req, res) => {
    const { pet_id, reason, user_id } = req.body; // Assuming user_id is sent in the request
    if (!pet_id || !reason || !user_id) {
        return res.status(400).send({ message: 'Missing required fields' });
    }
    db.run(
        `INSERT INTO adoption_requests (user_id, pet_id, reason) VALUES (?, ?, ?)`,
        [user_id, pet_id, reason],
        (err) => {
            if (err) {
                res.status(400).send({ message: 'Error submitting adoption request', error: err.message });
            } else {
                res.status(201).send({ message: 'Adoption request submitted successfully' });
            }
        }
    );
});

// Fetch Adoption Requests
app.get('/adoption-requests', authenticateToken, (req, res) => {
    const userId = req.user.id; // Get the authenticated user's ID from the token

    db.all(
        `SELECT ar.id, ar.reason, ar.status, u.username, p.name as pet_name
        FROM adoption_requests ar
        JOIN users u ON ar.user_id = u.id
        JOIN pets p ON ar.pet_id = p.id
        WHERE ar.user_id = ?`, // Filter by the authenticated user's ID
        [userId], // Pass the user ID as a parameter to the query
        (err, rows) => {
            if (err) {
                return res.status(500).send({ message: 'Error fetching adoption requests', error: err.message });
            }
            
            if (rows.length === 0) {
                return res.status(200).send([]); // Return an empty array if no requests are found
            }
            
            // Return the adoption requests for the authenticated user
            res.status(200).send(rows);
        }
    );
});


// Update Adoption Request Status
app.put('/update-request/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).send({ message: 'Status is required' });
    }

    db.run(
        `UPDATE adoption_requests SET status = ? WHERE id = ?`,
        [status, id],
        (err) => {
            if (err) {
                res.status(400).send({ message: 'Error updating request', error: err.message });
            } else {
                res.status(200).send({ message: 'Adoption request updated successfully' });
            }
        }
    );
});


// Profile Management
// Fetch Profile
app.get('/profile', authenticateToken, (req, res) => {
    const user_id = req.user?.id; // Ensure `user.id` exists
    if (!user_id) {
        return res.status(400).send({ message: 'User ID is missing in the token' });
    }

    db.get(`SELECT * FROM users WHERE id = ?`, [user_id], (err, row) => {
        if (err) {
            console.error('Error fetching profile:', err.message);
            return res.status(500).send({ message: 'Error fetching profile', error: err.message });
        }

        if (!row) {
            return res.status(404).send({ message: 'Profile not found' });
        }

        res.status(200).send(row);
    });
});

// Update Profile
app.put('/profile', authenticateToken, (req, res) => {
    const user_id = req.user?.id; // Ensure `user.id` exists
    const { name, contact_info, address } = req.body;

    if (!user_id || !name || !contact_info || !address) {
        return res.status(400).send({ message: 'Missing required fields' });
    }

    db.run(
        `UPDATE users SET name = ?, contact_info = ?, address = ? WHERE id = ?`,
        [name, contact_info, address, user_id],
        (err) => {
            if (err) {
                console.error('Error updating profile:', err.message);
                return res.status(500).send({ message: 'Error updating profile', error: err.message });
            }

            res.status(200).send({ message: 'Profile updated successfully' });
        }
    );
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

