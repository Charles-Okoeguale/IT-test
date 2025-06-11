import { connectDB, disconnectDB, clearDB } from './config/database';

beforeAll(async () => {
    await connectDB();
});

afterAll(async () => {
    await disconnectDB();
});

beforeEach(async () => {
    await clearDB();
}); 