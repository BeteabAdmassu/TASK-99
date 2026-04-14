import request from 'supertest';
import { app } from '../../src/app';
import { ORG_ID, loginAsAdmin, uniqueUsername } from '../helpers';

describe('Users', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAsAdmin();
  });

  it('POST /users creates a new user', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: uniqueUsername(), password: 'TestPassword123!' });
    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('POST /users with duplicate username returns 409', async () => {
    const username = uniqueUsername();
    await request(app)
      .post(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username, password: 'TestPassword123!' });

    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username, password: 'TestPassword123!' });
    expect(res.status).toBe(409);
  });

  it('GET /users lists users with pagination', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /users with short password returns 400', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: uniqueUsername(), password: 'short' });
    expect(res.status).toBe(400);
  });
});
