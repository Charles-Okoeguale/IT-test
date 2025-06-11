import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { AuthRequest, TokenPayload } from './types';
import { UserModel } from './models/user.model';
import { ItemModel } from './models/item.model';
import { connectDB } from './config/database';

const app = express();
app.use(express.json());

const SECRET_KEY = 'your-secret-key';
const PORT = 3000;

// Connect to MongoDB only in non-test environment
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// Register endpoint
app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const userExists = await UserModel.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await UserModel.create({
            email,
            password: hashedPassword
        });
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Authentication middleware
const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, SECRET_KEY) as TokenPayload;
        if (!Types.ObjectId.isValid(decoded.userId)) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.userId = decoded.userId;
        next();
    } catch (err) {
        console.error('Auth error:', err);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Add Item (Protected)
app.post('/api/items', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { name, price } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ error: 'Name and price are required' });
        }

        const item = await ItemModel.create({
            userId: new Types.ObjectId(req.userId),
            name,
            price: parseFloat(price.toString())
        });

        res.status(201).json(item);
    } catch (err) {
        console.error('Create item error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List User's Items (Protected)
app.get('/api/items', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const items = await ItemModel.find({ userId: new Types.ObjectId(req.userId) });
        res.json(items);
    } catch (err) {
        console.error('List items error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Item (Protected + Ownership Check)
app.put('/api/items/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = await ItemModel.findOne({
            _id: new Types.ObjectId(req.params.id),
            userId: new Types.ObjectId(req.userId)
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const updatedItem = await ItemModel.findByIdAndUpdate(
            req.params.id,
            { ...req.body, userId: item.userId },
            { new: true }
        );

        res.json(updatedItem);
    } catch (err) {
        console.error('Update item error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete Item (Protected + Ownership Check)
app.delete('/api/items/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = await ItemModel.findOne({
            _id: new Types.ObjectId(req.params.id),
            userId: new Types.ObjectId(req.userId)
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        await ItemModel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted' });
    } catch (err) {
        console.error('Delete item error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

export default app; 