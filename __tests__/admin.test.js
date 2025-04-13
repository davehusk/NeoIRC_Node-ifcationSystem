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
    .send({ identifier: 'admin', password: 'admin123' });
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('🛠️ Admin Panel', () => {
  it('Accesses admin dashboard', async () => {
    const res = await agent.get('/admin');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Admin Control Center/);
  });

  it('Changes user role to voiced', async () => {
    const res = await agent
      .post('/admin/role')
      .type('form')
      .send({ username: 'testuser', role: 'voiced' });

    const user = await User.findOne({ username: 'testuser' });
    expect(user.role).toBe('voiced');
  });

  it('Bans and unbans user', async () => {
    await agent.post('/admin/ban').type('form').send({ username: 'testuser', ban: true });
    let user = await User.findOne({ username: 'testuser' });
    expect(user.isBanned).toBe(true);

    await agent.post('/admin/ban').type('form').send({ username: 'testuser', ban: false });
    user = await User.findOne({ username: 'testuser' });
    expect(user.isBanned).toBe(false);
  });
});
