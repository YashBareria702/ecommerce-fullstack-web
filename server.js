const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const mysql = require('mysql2/promise'); 
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

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
    const { name, email, username, password } = req.body;
    const loginName = String(username || email || '').trim().toLowerCase();
    const displayName = String(name || loginName).trim().slice(0, 80);
    if (!/^[a-z0-9_.-]{3,32}$/.test(loginName)) return res.status(400).json({ message: 'Username must be 3–32 characters and use letters, numbers, dots, dashes or underscores.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    try {
        // Check if user already exists
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [loginName]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'That username is already taken. Please choose another.' });
        }

        // Hash the password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user into database
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [displayName, loginName, hashedPassword]
        );

        res.status(201).json({ message: 'Account created. You can now sign in.', username: loginName });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error during registration' });
    }
});

// 2. Login user
app.post('/api/login', async (req, res) => {
    const loginName = String(req.body.username || req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    try {
        // Find the user by email
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [loginName]);
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
        const token = jwt.sign({ id: user.id, username: user.email, role: 'customer' }, process.env.JWT_SECRET || 'my_super_secret_key', { expiresIn: '30d' });

        res.json({
            message: 'Logged in successfully',
            token: token,
            user: { id: user.id, name: user.name, username: user.email }
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

// Store owner access for the product management interface.
// Configure ADMIN_PASSWORD in the server's .env file before using this route.
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    let adminPassword = process.env.ADMIN_PASSWORD;
    try {
        adminPassword = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env'))).ADMIN_PASSWORD || adminPassword;
    } catch (_) {
        // Fall back to the process environment when no local .env file is present.
    }
    if (!adminPassword) {
        return res.status(503).json({ message: 'Owner login is not configured. Add ADMIN_PASSWORD to the server .env file.' });
    }
    if (typeof password !== 'string' || password.length < 1 || password !== adminPassword) {
        return res.status(401).json({ message: 'Incorrect owner password.' });
    }
    const token = jwt.sign({ role: 'owner' }, process.env.JWT_SECRET || 'my_super_secret_key', { expiresIn: '8h' });
    res.json({ token });
});

function indianMobile(value) {
    const digits = String(value || '').replace(/\D/g, '');
    const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    return /^[6-9]\d{9}$/.test(national) ? `91${national}` : null;
}

app.post('/api/orders/notify', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    let customer;
    try { customer = jwt.verify(authHeader.replace(/^Bearer\s+/i, ''), process.env.JWT_SECRET || 'my_super_secret_key'); }
    catch (_) { return res.status(401).json({ message: 'Please sign in before placing an order.' }); }
    const { orderId, customerName, total } = req.body;
    if (customer.role !== 'customer') return res.status(403).json({ message: 'Customer sign-in is required.' });
    const customerMobile = indianMobile(req.body.customerMobile);
    const ownerMobile = indianMobile(process.env.STORE_OWNER_PHONE);
    if (!customerMobile || !ownerMobile || !orderId || !Number.isFinite(Number(total))) {
        return res.status(503).json({ message: 'Order SMS needs MSG91 settings and STORE_OWNER_PHONE in the server .env file.' });
    }
    const authKey = process.env.MSG91_AUTH_KEY;
    const customerTemplateId = process.env.MSG91_CUSTOMER_ORDER_TEMPLATE_ID;
    const ownerTemplateId = process.env.MSG91_OWNER_ORDER_TEMPLATE_ID;
    if (!authKey || !customerTemplateId || !ownerTemplateId) return res.status(503).json({ message: 'Order SMS is not configured yet. Set both MSG91 order template IDs and MSG91_AUTH_KEY.' });
    const send = (mobiles, templateId) => axios.post('https://control.msg91.com/api/v5/flow', {
        template_id: templateId,
        short_url: '0',
        realTimeResponse: '1',
        recipients: [{ mobiles, VAR1: String(customerName || 'Customer'), VAR2: String(orderId), VAR3: String(total) }],
    }, { headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' }, timeout: 12000 });
    try {
        const results = await Promise.allSettled([send(customerMobile, customerTemplateId), send(ownerMobile, ownerTemplateId)]);
        const failed = results.some(result => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.data?.type === 'error'));
        if (failed) {
            console.error('MSG91 order notification failed:', results.map(result => result.status === 'rejected' ? result.reason.response?.data || result.reason.message : result.value.data));
            return res.status(502).json({ message: 'Order saved, but one or more SMS messages could not be sent.' });
        }
        return res.json({ message: 'Order SMS sent to the customer and store owner.' });
    } catch (error) {
        console.error('MSG91 order SMS failed:', error.response?.data || error.message);
        return res.status(502).json({ message: 'Order saved, but SMS could not be sent.' });
    }
});
