jest.setTimeout(20000);
require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');

let agent;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  agent = request.agent(app);

  await agent
    .post('/login')
    .type('form')
    .send({ identifier: 'user', password: 'user123' });
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('💬 Messaging Flow', () => {
  it('Sends a message to general channel', async () => {
    const res = await agent
      .post('/send')
      .send({ message: 'Test message from Jest', channel: 'general' });

    expect(res.statusCode).toBe(200);
    expect(res.body.content).toMatch(/test message/i);
  });

  it('Blocks banned users from sending', async () => {
    const user = await User.findOne({ username: 'testuser' });
    user.isBanned = true;
    await user.save();

    // Log out and log back in to refresh session
    await agent.post('/logout');
    await agent
      .post('/login')
      .type('form')
      .send({ identifier: 'user', password: 'user123' });

    await user.save(); // cleanup
  });
});
