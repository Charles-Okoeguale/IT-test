"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const lowdb_1 = __importDefault(require("lowdb"));
const FileSync_1 = __importDefault(require("lowdb/adapters/FileSync"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const adapter = new FileSync_1.default('db.json');
const db = (0, lowdb_1.default)(adapter);
const app = (0, express_1.default)();
app.use(express_1.default.json());
const SECRET_KEY = 'your-secret-key';
const PORT = 3000;
// Initialize db with empty arrays if needed
db.defaults({ users: [], items: [] }).write();
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
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = {
            id: Date.now().toString(),
            email,
            password: hashedPassword
        };
        db.get('users').push(user).write();
        res.status(201).json({ message: 'User registered successfully' });
    }
    catch (err) {
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
        const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Authentication middleware
const authenticate = (req, res, next) => {
    var _a;
    const token = (_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, SECRET_KEY);
        req.userId = decoded.userId;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
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
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// List User's Items (Protected)
app.get('/api/items', authenticate, (req, res) => {
    try {
        const items = db.get('items').filter({ userId: req.userId }).value();
        res.json(items);
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
exports.default = app;
