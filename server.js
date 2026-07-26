const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const mysql = require('mysql2/promise'); 
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 

// Create a database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the database connection
pool.getConnection()
    .then((connection) => {
        console.log('Successfully connected to MySQL database');
        connection.release();
    })
    .catch((err) => {
        console.error('Error connecting to MySQL:', err);
    });

// A simple test route
app.get('/', (req, res) => {
    res.send('E-commerce API is running');
});

// GET all products
app.get('/api/products', async (req, res) => {
    try {
        // Query the database to get everything from the products table
        const [products] = await pool.query('SELECT * FROM products');
        
        // Send the result back as JSON
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error fetching products' });
    }
});

// --- USER AUTHENTICATION ROUTES ---

// 1. Register a new user
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if user already exists
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user into database
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error during registration' });
    }
});

// 2. Login user
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = users[0];

        // Compare entered password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create a JWT token (a digital ID card for the user session)
        // Note: In production, store the JWT_SECRET in your .env file!
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'my_super_secret_key', { expiresIn: '1h' });

        res.json({
            message: 'Logged in successfully',
            token: token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error during login' });
    }
});

// 3. Process Checkout
app.post('/api/checkout', async (req, res) => {
    // We expect the frontend to send the cart items and the total price
    const { cartItems, totalAmount } = req.body;
    
    // Check if the user sent their digital ID card (JWT token)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        // Extract the token and verify it to get the user ID securely
        const token = authHeader.split(' ')[1]; // Removes the "Bearer " prefix
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my_super_secret_key');
        const userId = decoded.id;

        // Step 1: Create a new order in the orders table
        const [orderResult] = await pool.query(
            'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
            [userId, totalAmount, 'completed'] // Hardcoding 'completed' for testing
        );
        const orderId = orderResult.insertId; // Get the ID of the newly created order

        // Step 2: Loop through the cart and save each item to the order_items table
        for (let item of cartItems) {
            await pool.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
                [orderId, item.id, 1, item.price] // Defaulting quantity to 1 per click for simplicity
            );
        }

        res.status(201).json({ message: 'Order placed successfully!', orderId: orderId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error during checkout' });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});