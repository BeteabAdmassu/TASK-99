import request from 'supertest';
import { app } from '../../src/app';
import { ORG_ID, loginAsAdmin } from '../helpers';

describe('Threads', () => {
  let token: string;
  let sectionId: string;
  let subsectionId: string;
  let threadId: string;

  beforeAll(async () => {
    token = await loginAsAdmin();

    // Create section + subsection
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Section', displayOrder: 0 });
    sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Subsection', displayOrder: 0 });
    subsectionId = subRes.body.subsection.id;
  });

  it('POST /threads creates a thread', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subsectionId, title: 'Test Thread', body: 'Thread body content.' });
    expect(res.status).toBe(201);
    expect(res.body.thread.title).toBe('Test Thread');
    threadId = res.body.thread.id;
  });

  it('GET /threads lists threads', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads?subsectionId=${subsectionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /threads/:id returns thread detail', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.thread.id).toBe(threadId);
  });

  it('GET /threads/:id for non-existent thread returns 404', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads/00000000-0000-0000-0000-000000000099`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('PUT /threads/:id/state pins thread', async () => {
    const res = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadId}/state`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPinned: true });
    expect(res.status).toBe(200);
  });

  it('DELETE /threads/:id soft-deletes thread', async () => {
    // Create a new thread to delete
    const createRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subsectionId, title: 'To Delete', body: 'Will be deleted.' });
    const deleteId = createRes.body.thread.id;

    const res = await request(app)
      .delete(`/api/organizations/${ORG_ID}/threads/${deleteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});
