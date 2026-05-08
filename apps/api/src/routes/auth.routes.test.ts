import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db/registry', () => {
  const meta = { host: '127.0.0.1', port: 3306, user: 'root', useTLS: false };
  return {
    registry: {
      create: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
      get: vi.fn(() => null),
      meta: vi.fn(() => meta),
      has: vi.fn(() => true),
      startSweep: vi.fn(),
      stopSweep: vi.fn(),
      destroyAll: vi.fn(async () => undefined),
    },
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
    expect(res.body.authenticated).toBe(false);
  });

  it('POST /auth/login with full connection params succeeds and sets a session cookie', async () => {
    const { createApp } = await import('../app');
    const res = await request(createApp()).post('/auth/login').send({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'whatever',
      useTLS: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.connection).toMatchObject({ host: '127.0.0.1', user: 'root' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/dbi\.sid=/);
  });

  it('POST /auth/login rejects missing host', async () => {
    const { createApp } = await import('../app');
    const res = await request(createApp()).post('/auth/login').send({ user: 'root' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('POST /auth/login rejects an invalid host', async () => {
    const { createApp } = await import('../app');
    const res = await request(createApp()).post('/auth/login').send({
      host: 'has spaces',
      user: 'root',
      password: 'x',
    });
    expect(res.status).toBe(400);
  });
});
