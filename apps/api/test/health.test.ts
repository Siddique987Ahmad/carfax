import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './harness';

describe('GET /v1/health', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startTestApp();
  });
  afterAll(async () => {
    await t?.close();
  });

  it('reports the database and Redis as up', async () => {
    const res = await t.http.get('/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('sends a request id back on every response', async () => {
    const res = await t.http.get('/v1/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('GET /v1/health with Redis unreachable', () => {
  let t: TestApp;
  beforeAll(async () => {
    // Nothing listens on this port.
    t = await startTestApp({ env: { REDIS_URL: 'redis://127.0.0.1:6390' } });
  });
  afterAll(async () => {
    await t?.close();
  });

  it('answers 503 quickly, naming what is down', async () => {
    const started = Date.now();
    const res = await t.http.get('/v1/health').expect(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'up', redis: 'down' } });
    expect(Date.now() - started).toBeLessThan(2500);
  });
});
