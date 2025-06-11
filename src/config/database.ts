import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export const connectDB = async () => {
    try {
        if (process.env.NODE_ENV === 'test') {
            // Use in-memory MongoDB for testing
            mongoServer = await MongoMemoryServer.create();
            const mongoUri = mongoServer.getUri();
            await mongoose.connect(mongoUri);
        } else {
            // Use real MongoDB for development/production
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/integration_test';
            await mongoose.connect(mongoUri);
        }
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

export const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
        console.log('MongoDB disconnected successfully');
    } catch (err) {
        console.error('MongoDB disconnection error:', err);
    }
};

export const clearDB = async () => {
    if (process.env.NODE_ENV === 'test') {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    }
}; 