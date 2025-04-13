jest.setTimeout(20000);
require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const Channel = require('../models/Channel');

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
  await Channel.deleteOne({ name: 'testrun' });
  await mongoose.disconnect();
});

describe('📡 Channel Management', () => {
  it('Creates new channel', async () => {
    const res = await agent
      .post('/channels/create')
      .type('form')
      .send({ name: 'testrun', description: 'Testing channel' });

    expect(res.statusCode).toBe(302);

    const exists = await Channel.findOne({ name: 'testrun' });
    expect(exists).toBeTruthy();
  });
});
