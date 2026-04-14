import request from 'supertest';
import { app } from '../src/app';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000002';

export { ORG_ID, ADMIN_ID };

export async function loginAsAdmin(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'admin',
      password: 'Admin12345678!',
      organizationId: ORG_ID,
    });
  return res.body.token;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

let counter = 0;
export function uniqueUsername(): string {
  counter++;
  return `testuser_${Date.now()}_${counter}`;
}
