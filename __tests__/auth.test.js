jest.setTimeout(20000);
require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('🔐 Auth Flow', () => {
  it('Signs up a new user', async () => {
    // 🧼 Cleanup any existing user
    await User.deleteOne({ username: 'testuser' });
  
    const res = await request(app)
      .post('/signup')
      .type('form')
      .send({
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'testpass123'
      });
  
    // Expect redirect to dashboard
    expect(res.statusCode).toBe(302);
  
    const user = await User.findOne({ username: 'testuser' });
    expect(user).toBeTruthy();
  });
  

  it('Fails login with wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({
        identifier: 'testuser',
        password: 'wrongpass'
      });

    expect(res.text).toMatch(/Invalid credentials/);
  });
});
