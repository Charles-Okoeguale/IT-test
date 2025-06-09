const express = require('express');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const adapter = new FileSync('db.json');
const db = low(adapter);

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

const SECRET_KEY = 'your-secret-key';
const PORT = 3000;

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const userExists = db.get('users').find({ email }).value();
        if (userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { id: Date.now().toString(), email, password: hashedPassword };
        db.get('users').push(user).write();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = db.get('users').find({ email }).value();
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Authentication middleware
const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Protected route example (to be used later)
app.get('/api/protected', authenticate, (req, res) => {
    res.json({ message: 'This is a protected route', userId: req.userId });
});

// Get all users
app.get('/api/users', (req, res) => {
    const users = db.get('users').value();
    res.json({ status: 'success', data: users });
});

// Get users by role
app.get('/api/users/role/:role', (req, res) => {
    const { role } = req.params;
    const users = db.get('users')
        .filter({ role })
        .value();
    
    res.json({ 
        status: 'success',
        data: users
    });
});

// Get users above certain age
app.get('/api/users/age/:minAge', (req, res) => {
    const minAge = parseInt(req.params.minAge);
    const users = db.get('users')
        .filter(user => user.age >= minAge)
        .value();
    
    res.json({ 
        status: 'success',
        data: users
    });
});

// Add Item (Protected)
app.post('/api/items', authenticate, (req, res) => {
    try {
        const { name, price } = req.body;
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' });
        }
        const item = { 
            id: Date.now().toString(), 
            userId: req.userId, 
            name, 
            price: parseFloat(price) 
        };
        db.get('items').push(item).write();
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List User's Items (Protected)
app.get('/api/items', authenticate, (req, res) => {
    try {
        const items = db.get('items').filter({ userId: req.userId }).value();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Item (Protected + Ownership Check)
app.put('/api/items/:id', authenticate, (req, res) => {
    try {
        const item = db.get('items').find({ id: req.params.id }).value();
        if (!item || item.userId !== req.userId) {
            return res.status(403).json({ error: 'Forbidden: Not your item' });
        }
        const updatedItem = { ...item, ...req.body };
        db.get('items').find({ id: req.params.id }).assign(updatedItem).write();
        res.json(updatedItem);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete Item (Protected + Ownership Check)
app.delete('/api/items/:id', authenticate, (req, res) => {
    try {
        const item = db.get('items').find({ id: req.params.id }).value();
        if (!item || item.userId !== req.userId) {
            return res.status(403).json({ error: 'Forbidden: Not your item' });
        }
        db.get('items').remove({ id: req.params.id }).write();
        res.json({ message: 'Item deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app; 