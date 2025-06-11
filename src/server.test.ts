import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import app from './server';


interface ItemResponse {
    _id: string;
    name: string;
    price: number;
    userId: string;
}

describe('Full Auth + CRUD Integration Test', () => {
    let token: string;
    let testItemId: string;
    let testUserId: string;

    // Auth Flow: Register → Login
    test('Register and login to get token', async () => {
        const testUser = {
            email: 'test@user.com',
            password: 'password123'
        };

        // Register
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send(testUser)
            .expect(201);

        expect(registerRes.body).toHaveProperty('message', 'User registered successfully');

        // Login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send(testUser)
            .expect(200);

        token = loginRes.body.token;
        expect(token).toBeDefined();

        // Decode token to get user ID
        const decoded = jwt.verify(token, 'your-secret-key') as { userId: string };
        testUserId = decoded.userId;
        expect(Types.ObjectId.isValid(testUserId)).toBeTruthy();
    });

    // Item CRUD Flow
    test('Full CRUD flow for items', async () => {
        const testItem = {
            name: 'Test Item',
            price: 100
        };

        // Create Item
        const createRes = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send(testItem)
            .expect(201);

        const createdItem = createRes.body as ItemResponse;
        testItemId = createdItem._id;
        expect(createdItem.name).toBe(testItem.name);
        expect(createdItem.price).toBe(testItem.price);
        expect(createdItem.userId).toBe(testUserId);

        // Read Items
        const readRes = await request(app)
            .get('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const items = readRes.body as ItemResponse[];
        expect(Array.isArray(items)).toBeTruthy();
        expect(items.some(item => item._id === testItemId)).toBeTruthy();

        // Update Item
        const updateData = {
            name: 'Updated Item',
            price: 200
        };

        const updateRes = await request(app)
            .put(`/api/items/${testItemId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updateData)
            .expect(200);

        const updatedItem = updateRes.body as ItemResponse;
        expect(updatedItem.name).toBe(updateData.name);
        expect(updatedItem.price).toBe(updateData.price);
        expect(updatedItem.userId).toBe(testUserId);

        // Delete Item
        await request(app)
            .delete(`/api/items/${testItemId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        // Verify Deletion
        const afterDelete = await request(app)
            .get('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const remainingItems = afterDelete.body as ItemResponse[];
        expect(remainingItems.some(item => item._id === testItemId)).toBeFalsy();
    });

    // Error Cases
    test('Reject unauthenticated CRUD operations', async () => {
        const testItem = {
            name: 'Test',
            price: 100
        };

        await request(app)
            .post('/api/items')
            .send(testItem)
            .expect(401);

        await request(app)
            .get('/api/items')
            .expect(401);
    });

    test('Reject invalid ownership (update/delete)', async () => {
        // Create item with test user
        const testItem = {
            name: 'Test',
            price: 100
        };

        const itemRes = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send(testItem)
            .expect(201);

        const createdItem = itemRes.body as ItemResponse;

        // Create a valid MongoDB ObjectId for the fake user
        const fakeUserId = new Types.ObjectId().toString();
        const fakeToken = jwt.sign({ userId: fakeUserId }, 'your-secret-key');

        // Should return 404 since the item doesn't belong to the fake user
        await request(app)
            .put(`/api/items/${createdItem._id}`)
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ name: 'Hacked' })
            .expect(404);

        await request(app)
            .delete(`/api/items/${createdItem._id}`)
            .set('Authorization', `Bearer ${fakeToken}`)
            .expect(404);

        // Verify the item still exists and is unchanged
        const verifyRes = await request(app)
            .get('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const items = verifyRes.body as ItemResponse[];
        const unchangedItem = items.find(item => item._id === createdItem._id);
        expect(unchangedItem).toBeDefined();
        expect(unchangedItem?.name).toBe(testItem.name);
        expect(unchangedItem?.price).toBe(testItem.price);
    });
}); 