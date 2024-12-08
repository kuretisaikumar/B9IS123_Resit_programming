const request = require('supertest');
const http = require('http');
const app = require('../server'); // Import your Express app
const sqlite3 = require('sqlite3');

// Declare server and database variables
let server;
let db;

const jwt = require('jsonwebtoken');
const adminToken = jwt.sign({ role: 'admin' }, 'your_secret_key');
const userToken = jwt.sign({ role: 'user' }, 'your_secret_key');

beforeAll((done) => {
    // Set up SQLite database before tests
    db = new sqlite3.Database('./data/pet_adoption.db', (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    });

    // Start the server
    server = http.createServer(app);
    server.listen(() => {
        done();
    });
});

afterAll((done) => {
    // Close the SQLite database and stop the server
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('SQLite database closed');
        }
        // Stop the server and allow Jest to finish
        server.close(done);
    });
});

describe('Server Tests', () => {
    test('GET /pets should return status 200', async () => {
        const res = await request(server).get('/pets');
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
    });

    test('POST /signup should create a new user', async () => {
        const res = await request(server)
            .post('/signup')
            .send({
                email: 'testuser2@example.com',
                username: 'testuser',
                password: 'testpassword',
                name: 'Test User',
                contact_info: '1234567890',
                address: 'Test Address'
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Account created successfully');
    });

    test('POST /signup should fail for duplicate email', async () => {
        const res = await request(server)
            .post('/signup')
            .send({
                email: 'testuser@example.com',
                username: 'anotheruser',
                password: 'password123',
                name: 'Another User',
                contact_info: '0987654321',
                address: 'Another Address'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Error creating account');
    });

    test('POST /signin should authenticate user successfully', async () => {
        const res = await request(server)
            .post('/signin')
            .send({
                email: 'testuser@example.com',
                password: 'testpassword',
            });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Login successful');
        expect(res.body.token).toBeDefined(); // Check if a token is returned
    });

    test('POST /signin should fail with incorrect credentials', async () => {
        const res = await request(server)
            .post('/signin')
            .send({
                email: 'testuser@example.com',
                password: 'wrongpassword',
            });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid credentials');
    });

    describe('POST /add-pet Route Tests', () => {
        const validAdminToken = `Bearer ${jwt.sign({ role: 'admin', id: 1 }, 'your_jwt_secret', { expiresIn: '1h' })}`;
        const validUserToken = `Bearer ${jwt.sign({ role: 'user', id: 2 }, 'your_jwt_secret', { expiresIn: '1h' })}`;
        const invalidToken = 'Bearer invalid.token.here';
    
        test('Should allow admin to add a pet', async () => {
            const res = await request(server)
                .post('/add-pet')
                .set('Authorization', validAdminToken)
                .send({
                    name: 'Buddy',
                    breed: 'Golden Retriever',
                    age: 3,
                    size: 'Large',
                    health_status: 'Healthy',
                    vaccination_details: 'Fully vaccinated',
                    image: 'buddy.jpg',
                    description: 'Friendly and playful dog',
                });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Pet added successfully!');
        });

        test('Should deny access for user role', async () => {
            const res = await request(server)
                .post('/add-pet')
                .set('Authorization', validUserToken)
                .send({
                    name: 'Buddy',
                    breed: 'Golden Retriever',
                    age: 3,
                    size: 'Large',
                    health_status: 'Healthy',
                    vaccination_details: 'Fully vaccinated',
                    image: 'buddy.jpg',
                    description: 'Friendly and playful dog',
                });

            expect(res.status).toBe(403);
            expect(res.body.message).toBe('Insufficient permissions: Role not allowed');
        });

        test('Should return 401 if no token is provided', async () => {
            const res = await request(server)
                .post('/add-pet')
                .send({
                    name: 'Buddy',
                    breed: 'Golden Retriever',
                    age: 3,
                    size: 'Large',
                    health_status: 'Healthy',
                    vaccination_details: 'Fully vaccinated',
                    image: 'buddy.jpg',
                    description: 'Friendly and playful dog',
                });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Access Denied: No token provided');
        });

        test('Should return 400 for invalid token format', async () => {
            const res = await request(server)
                .post('/add-pet')
                .set('Authorization', 'InvalidFormatToken')
                .send({
                    name: 'Buddy',
                    breed: 'Golden Retriever',
                    age: 3,
                    size: 'Large',
                    health_status: 'Healthy',
                    vaccination_details: 'Fully vaccinated',
                    image: 'buddy.jpg',
                    description: 'Friendly and playful dog',
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Invalid token format. Use Bearer <token>');
        });

        test('Should return 403 for invalid or expired token', async () => {
            const res = await request(server)
                .post('/add-pet')
                .set('Authorization', invalidToken)
                .send({
                    name: 'Buddy',
                    breed: 'Golden Retriever',
                    age: 3,
                    size: 'Large',
                    health_status: 'Healthy',
                    vaccination_details: 'Fully vaccinated',
                    image: 'buddy.jpg',
                    description: 'Friendly and playful dog',
                });

            expect(res.status).toBe(403);
            expect(res.body.message).toBe('Invalid Token or expired token');
        });

        test('Should return 400 if required fields are missing', async () => {
            const res = await request(server)
                .post('/add-pet')
                .set('Authorization', validAdminToken)
                .send({
                    name: 'Buddy',
                    breed: 'Golden Retriever',
                    age: 3,
                    size: 'Large',
                    health_status: 'Healthy',
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('All fields are required.');
        });
    });

    // -------------- New Tests --------------

    describe('DELETE /delete-pet Route Tests', () => {
        const validAdminToken = `Bearer ${jwt.sign({ role: 'admin', id: 1 }, 'your_jwt_secret', { expiresIn: '1h' })}`;
        const validUserToken = `Bearer ${jwt.sign({ role: 'user', id: 2 }, 'your_jwt_secret', { expiresIn: '1h' })}`;
        const invalidToken = 'Bearer invalid.token.here';
        let petId;

        beforeAll(async () => {
            // Create a pet to test deletion
            const res = await request(server)
                .post('/add-pet')
                .set('Authorization', validAdminToken)
                .send({
                    name: 'Max',
                    breed: 'Bulldog',
                    age: 5,
                    size: 'Medium',
                    health_status: 'Healthy',
                    vaccination_details: 'Fully vaccinated',
                    image: 'max.jpg',
                    description: 'Loyal bulldog',
                });
            petId = res.body.id; // Store the pet ID for deletion test
        });

        test('Should allow admin to delete a pet', async () => {
            const res = await request(server)
                .delete(`/delete-pet/${petId}`)
                .set('Authorization', validAdminToken);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Pet deleted successfully');
        });

        test('Should deny access for non-admin users to delete a pet', async () => {
            const res = await request(server)
                .delete(`/delete-pet/${petId}`)
                .set('Authorization', validUserToken);

            expect(res.status).toBe(403);
            expect(res.body.message).toBe('Insufficient permissions: Role not allowed');
        });
    });

    describe('POST /adopt Route Tests', () => {
        const validAdminToken = `Bearer ${jwt.sign({ role: 'admin', id: 1 }, 'your_jwt_secret', { expiresIn: '1h' })}`;
        const validUserToken = `Bearer ${jwt.sign({ role: 'user', id: 2 }, 'your_jwt_secret', { expiresIn: '1h' })}`;
        const invalidToken = 'Bearer invalid.token.here';
        test('Should allow a user to submit an adoption request', async () => {
            const res = await request(server)
                .post('/adopt')
                .set('Authorization', validUserToken)
                .send({
                    pet_id: 1,
                    reason: 'Looking for a companion',
                    user_id: 2,
                });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Adoption request submitted successfully');
        });

        test('Should return 400 if required fields are missing', async () => {
            const res = await request(server)
                .post('/adopt')
                .set('Authorization', validUserToken)
                .send({
                    pet_id: 1,
                    user_id: 2,
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Missing required fields');
        });
    });
});
