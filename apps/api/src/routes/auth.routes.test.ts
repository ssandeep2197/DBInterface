import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db/pool', () => {
  const noop = vi.fn();
  return {
    getPool: () => ({ query: vi.fn().mockResolvedValue([[], []]), end: noop }),
    reinitPool: vi.fn(async () => ({ query: vi.fn().mockResolvedValue([[{ '1': 1 }], []]), end: noop })),
    closePool: vi.fn(async () => undefined),
  };
});

beforeAll(() => {
  process.env.SESSION_SECRET = 'a'.repeat(40);
  process.env.NODE_ENV = 'test';
});

describe('auth routes', () => {
  it('GET /auth/session returns authenticated:false initially', async () => {
    const { createApp } = await import('../app');
    const res = await request(createApp()).get('/auth/session');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it('POST /auth/login succeeds and sets a session cookie', async () => {
    const { createApp } = await import('../app');
    const res = await request(createApp())
      .post('/auth/login')
      .send({ password: 'whatever' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: true });
    expect(res.headers['set-cookie']?.[0]).toMatch(/dbi\.sid=/);
  });

  it('POST /auth/login rejects missing password', async () => {
    const { createApp } = await import('../app');
    const res = await request(createApp()).post('/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
