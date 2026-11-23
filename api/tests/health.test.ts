import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('HCMS API Core & Health Check', () => {
  it('GET /api/health returns 200 with status ok and connected database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('database', 'connected');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('service', 'hmcs-api');
  });

  it('GET /api/nonexistent returns 404 in standardized error format', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.message).toBe('string');
  });
});
