const request = require('supertest');
const app = require('./server');
const jwt = require('jsonwebtoken');

describe('API Integration Tests', () => {
    test('GET /api/users should return all users', async () => {
        const response = await request(app)
            .get('/api/users')
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body.status).toBe('success');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(4);
    });

    test('GET /api/users/role/developer should return only developers', async () => {
        const response = await request(app)
            .get('/api/users/role/developer')
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body.status).toBe('success');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(2);
        expect(response.body.data.every(user => user.role === 'developer')).toBe(true);
    });

    test('GET /api/users/age/30 should return users 30 or older', async () => {
        const response = await request(app)
            .get('/api/users/age/30')
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body.status).toBe('success');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.every(user => user.age >= 30)).toBe(true);
    });

    test('GET /non-existent should return 404', async () => {
        await request(app)
            .get('/non-existent')
            .expect(404);
    });
});

describe('Full Auth + CRUD Integration Test', () => {
    let token;
    let testItemId;

    // Auth Flow: Register → Login
    test('Register and login to get token', async () => {
        // Register
        await request(app)
            .post('/api/auth/register')
            .send({ email: 'test@user.com', password: 'password123' })
            .expect(201);

        // Login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@user.com', password: 'password123' })
            .expect(200);

        token = loginRes.body.token;
        expect(token).toBeDefined();
    });

    // Item CRUD Flow
    test('Full CRUD flow for items', async () => {
        // Create Item
        const createRes = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Test Item', price: 100 })
            .expect(201);

        testItemId = createRes.body.id;
        expect(createRes.body.name).toBe('Test Item');

        // Read Items
        const readRes = await request(app)
            .get('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(readRes.body.some(item => item.id === testItemId)).toBe(true);

        // Update Item
        await request(app)
            .put(`/api/items/${testItemId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated Item', price: 200 })
            .expect(200);

        // Verify Update
        const updatedItem = await request(app)
            .get('/api/items')
            .set('Authorization', `Bearer ${token}`);

        expect(updatedItem.body.find(item => item.id === testItemId).name).toBe('Updated Item');

        // Delete Item
        await request(app)
            .delete(`/api/items/${testItemId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        // Verify Deletion
        const afterDelete = await request(app)
            .get('/api/items')
            .set('Authorization', `Bearer ${token}`);

        expect(afterDelete.body.some(item => item.id === testItemId)).toBe(false);
    });

    // Error Cases
    test('Reject unauthenticated CRUD operations', async () => {
        await request(app)
            .post('/api/items')
            .send({ name: 'Test', price: 100 })
            .expect(401);

        await request(app)
            .get('/api/items')
            .expect(401);
    });

    test('Reject invalid ownership (update/delete)', async () => {
        // Create item with test user
        const itemRes = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Test', price: 100 });

        // Simulate another user's token
        const fakeToken = jwt.sign({ userId: 'fake-user-id' }, 'your-secret-key');

        await request(app)
            .put(`/api/items/${itemRes.body.id}`)
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ name: 'Hacked' })
            .expect(403);

        await request(app)
            .delete(`/api/items/${itemRes.body.id}`)
            .set('Authorization', `Bearer ${fakeToken}`)
            .expect(403);
    });
}); 