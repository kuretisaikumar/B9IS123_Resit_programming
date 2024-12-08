
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
const port = 3000;

app.use(cors({
    origin: 'http://localhost:3000', // Allow the frontend origin
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type,Authorization'
}));
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
            address TEXT,
            role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user'
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
            user_id INTEGER UNIQUE,
            pet_id INTEGER UNIQUE,
            reason TEXT,
            status TEXT DEFAULT 'Pending',
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(pet_id) REFERENCES pets(id)
        )`);
    }
});

// User endpoints
app.post('/signup', async (req, res) => {
    const { email, username, password, name, contact_info, address } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (email, username, password,name,contact_info,address) VALUES (?, ?, ?, ?, ?,?)`, [email, username, hashedPassword, name, contact_info, address], (err) => {
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
            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

            // Send the token, user_id, role, and name in the response
            res.status(200).send({
                message: 'Login successful',
                token: token,      // JWT token
                user_id: user.id,  // Include the user_id
                role: user.role,   // Include the user's role
                name: user.username   // Include the user's name
            });
        } else {
            res.status(401).send({ message: 'Invalid credentials' });
        }
    });
});


/// Middleware for verifying JWT and role-based access control


function authenticateToken(requiredRole) {
    return (req, res, next) => {
        const token = req.headers['authorization'];

        // Check if token is provided
        if (!token) {
            console.error('No token provided');
            return res.status(401).send({ message: 'Access Denied: No token provided' });
        }

        // Extract token from "Bearer <token>" format
        const tokenValue = token.split(' ')[1];
        if (!tokenValue) {
            console.error('Invalid token format');
            return res.status(400).send({ message: 'Invalid token format. Use Bearer <token>' });
        }

        // Verify token
        jwt.verify(tokenValue, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('Invalid or expired token:', err.message);
                return res.status(403).send({ message: 'Invalid Token or expired token' });
            }

            // Add the user info from the token to the request object
            req.user = user;

            // Check if the user has the required role (if requiredRole is provided)
            if (requiredRole && user.role !== requiredRole) {
                console.error('Insufficient role:', user.role);
                return res.status(403).send({ message: 'Insufficient permissions: Role not allowed' });
            }

            // Continue with the request
            next();
        });
    };
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
app.get('/admin/dashboard-stats', authenticateToken('admin'), async (req, res) => {
    try {
        // Helper function to wrap db.get in a Promise
        const runQuery = (query) => {
            return new Promise((resolve, reject) => {
                db.get(query, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        };

        // Execute all queries in parallel
        const [totalUsers, totalPets, totalRequests] = await Promise.all([
            runQuery('SELECT COUNT(*) AS total_users FROM users'),
            runQuery('SELECT COUNT(*) AS total_pets FROM pets'),
            runQuery('SELECT COUNT(*) AS total_requests FROM adoption_requests')
        ]);

        // Send the aggregated result
        res.json({
            total_users: totalUsers.total_users,
            total_pets: totalPets.total_pets,
            total_requests: totalRequests.total_requests
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
});


app.get('/admin/users', authenticateToken('admin'), (req, res) => {
    db.all('SELECT id, name, email, role FROM users', (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch users' });
        }
        res.json(rows);
    });
});
app.put('/admin/users/:id/change-role', authenticateToken('admin'), (req, res) => {
    const { id } = req.params;
    db.run('UPDATE users SET role = "admin" WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Failed to change user role' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User role updated to admin' });
    });
});
app.delete('/admin/users/:id', authenticateToken('admin'), (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Failed to delete user' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    });
});

app.post('/add-pet', authenticateToken('admin'), (req, res) => {  // 'admin' role required
    console.log('Request received:', req.body);
    console.log('Authenticated user:', req.user);

    const { name, breed, age, size, health_status, vaccination_details, image, description } = req.body;

    // Check for missing fields
    if (!name || !breed || !age || !size || !health_status || !vaccination_details || !image || !description) {
        return res.status(400).send({ message: 'All fields are required.' });
    }

    // Insert pet into the database
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

app.put('/pets/:id/adopt', authenticateToken('admin'), (req, res) => {
    const petId = req.params.id;

    // Prepare the query to update the pet status to 'Adopted'
    const query = `UPDATE pets SET status = 'Adopted' WHERE id = ?`;

    // Update the pet's status to "Adopted"
    db.run(query, [petId], function (err) {
        if (err) {
            console.error('Error updating pet status:', err);
            return res.status(500).send({ message: 'Failed to update pet status.' });
        }

        if (this.changes === 0) {
            return res.status(404).send({ message: 'Pet not found.' });
        }

        res.status(200).send({ message: 'Pet status updated to Adopted successfully.' });
    });
});



app.put('/update-pet/:id', authenticateToken('admin'), (req, res) => {
    const { id } = req.params;
    const { name, breed, age, size, health_status, vaccination_details, image, status, description } = req.body;

    // Check if all required fields are provided
    if (!name || !breed || !age || !size || !health_status || !vaccination_details || !image || !status || !description) {
        return res.status(400).send({ message: 'All fields are required' });
    }

    // Update pet information in the database
    db.run(
        `UPDATE pets SET name = ?, breed = ?, age = ?, size = ?, health_status = ?, vaccination_details = ?, image = ?, status = ?, description = ? WHERE id = ?`,
        [name, breed, age, size, health_status, vaccination_details, image, status, description, id],
        (err) => {
            if (err) {
                console.error('Error updating pet:', err.message);
                return res.status(400).send({ message: 'Error updating pet', error: err.message });
            }
            return res.status(200).send({ message: 'Pet updated successfully' });
        }
    );
});


app.delete('/delete-pet/:id', authenticateToken('admin'), (req, res) => {  // 'admin' role required
    const { id } = req.params;

    // Delete the pet from the database
    db.run(`DELETE FROM pets WHERE id = ?`, [id], (err) => {
        if (err) {
            console.error('Database error:', err.message);
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

    // Check if the user has already submitted an adoption request for the same pet
    db.get(
        `SELECT * FROM adoption_requests WHERE user_id = ? AND pet_id = ?`,
        [user_id, pet_id],
        (err, row) => {
            if (err) {
                return res.status(400).send({ message: 'Error checking adoption request', error: err.message });
            }
            
            // If a request already exists for this pet and user, deny the new request
            if (row) {
                return res.status(400).send({ message: 'You have already submitted an adoption request for this pet' });
            }

            // Otherwise, insert the new adoption request
            db.run(
                `INSERT INTO adoption_requests (user_id, pet_id, reason) VALUES (?, ?, ?)`,
                [user_id, pet_id, reason],
                (err) => {
                    if (err) {
                        return res.status(400).send({ message: 'Error submitting adoption request', error: err.message });
                    } else {
                        return res.status(201).send({ message: 'Adoption request submitted successfully' });
                    }
                }
            );
        }
    );
});


// Fetch Adoption Requests
app.get('/adoption-requests', authenticateToken(), (req, res) => {
    const userId = req.user.id; // Get the authenticated user's ID from the token
    console.log(`Fetching adoption requests for user: ${userId}`); // Debugging log

    // SQL query to fetch adoption requests for the authenticated user
    const query = `
        SELECT ar.id, ar.reason, ar.status, u.username, p.name as pet_name
        FROM adoption_requests ar
        JOIN users u ON ar.user_id = u.id
        JOIN pets p ON ar.pet_id = p.id
        WHERE ar.user_id = ?`;

    // Execute the SQL query
    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send({ message: 'An error occurred while fetching adoption requests.' });
        }

        if (rows.length === 0) {
            console.log(`No adoption requests found for user: ${userId}`);
            return res.status(200).json({ data: [], message: 'No adoption requests found.' });
        }

        console.log(`Adoption requests for user ${userId}:`, rows);
        res.status(200).json({ data: rows, message: 'Adoption requests fetched successfully.' });
    });
});



// Route to update the status of an adoption request (for Admin)
app.put('/update-request/:id', authenticateToken('admin'), (req, res) => {
    const { id } = req.params;  // The adoption request ID
    const { status } = req.body;  // The new status (approved, rejected, pending)

    // Check if status is provided
    if (!status) {
        return res.status(400).send({ message: 'Status is required' });
    }

    // Update the status of the adoption request
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
app.get('/profile', authenticateToken(), (req, res) => {
    const userId = req.user.id; // User ID extracted from the token by the middleware

    const query = `
        SELECT name, contact_info, address, username, email
        FROM users
        WHERE id = ?
    `;

    // Fetch the user profile from the database
    db.get(query, [userId], (err, row) => {
        if (err) {
            console.error('Error fetching profile:', err);
            return res.status(500).send({ message: 'Failed to fetch profile.' });
        }

        if (!row) {
            return res.status(404).send({ message: 'User not found.' });
        }

        // Send the user profile data as a response
        res.status(200).json(row);
    });
});
app.get('/admin/dashboard-stats', authenticateToken('admin'), async (req, res) => {
    try {
        // Fetch total users, pets, and adoption requests
        const totalUsers = await db.get(`SELECT COUNT(*) AS count FROM users`);
        const totalPets = await db.get(`SELECT COUNT(*) AS count FROM pets`);
        const totalRequests = await db.get(`SELECT COUNT(*) AS count FROM adoption_requests`);

        // Respond with the data
        res.json({
            total_users: totalUsers.count,
            total_pets: totalPets.count,
            total_requests: totalRequests.count,
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard stats.' });
    }
});

// Update Profile
app.put('/update-profile', authenticateToken(), (req, res) => {
    const userId = req.user.id; // User ID extracted from the token by the middleware
    const { name, contact_info, address, username } = req.body;

    // Validate input data
    if (!name || !contact_info || !address || !username) {
        return res.status(400).send({ message: 'All fields (name, contact_info, address, username) are required.' });
    }

    // Check if the username already exists (to prevent duplicates)
    const checkUsernameQuery = `
        SELECT id FROM users WHERE username = ? AND id != ?
    `;
    db.get(checkUsernameQuery, [username, userId], (err, row) => {
        if (err) {
            console.error('Error checking username availability:', err);
            return res.status(500).send({ message: 'Failed to check username availability.' });
        }

        if (row) {
            return res.status(400).send({ message: 'Username is already taken.' });
        }

        // Proceed to update the user's profile
        const query = `
            UPDATE users
            SET name = ?, contact_info = ?, address = ?, username = ?
            WHERE id = ?
        `;

        // Update the user profile in the database
        db.run(query, [name, contact_info, address, username, userId], function (err) {
            if (err) {
                console.error('Error updating profile:', err);
                return res.status(500).send({ message: 'Failed to update profile.' });
            }

            if (this.changes === 0) {
                return res.status(404).send({ message: 'User not found.' });
            }

            res.status(200).send({ message: 'Profile updated successfully.' });
        });
    });
});


// Route to manage all adoption requests (for Admin)
app.get('/manage-requests', authenticateToken('admin'), (req, res) => {
    // The admin is authenticated, now we can fetch all adoption requests
    db.all(
        `SELECT ar.id, ar.reason, ar.status, u.username, p.name as pet_name
        FROM adoption_requests ar
        JOIN users u ON ar.user_id = u.id
        JOIN pets p ON ar.pet_id = p.id`,
        (err, rows) => {
            if (err) {
                return res.status(500).send({ message: 'Error fetching adoption requests', error: err.message });
            }

            if (rows.length === 0) {
                return res.status(200).send([]);  // Return an empty array if no requests are found
            }

            // Return the adoption requests for the admin
            res.status(200).send(rows);
        }
    );
});

module.exports = app;
// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
