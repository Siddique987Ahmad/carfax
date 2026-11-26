import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './harness';

// Its own file: log assertions need the only app in the file (see harness.ts).
describe('Redis outage logging', () => {
  let t: TestApp;
  beforeAll(async () => {
    // Nothing listens on this port, so every reconnect attempt fails.
    t = await startTestApp({ env: { REDIS_URL: 'redis://127.0.0.1:6391' } });
  });
  afterAll(async () => {
    await t?.close();
  });

  it('logs "connection lost" once, not once per retry', async () => {
    await t.http.get('/v1/health').expect(503);
    // Give ioredis time for several reconnect attempts.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await t.http.get('/v1/health').expect(503);
    // One line per connection: the API's Redis client and the job queue's each log their outage once.
    const apiRedis = t.logs.filter((line) => line.includes('connection lost (retrying)'));
    const queue = t.logs.filter((line) => line.includes('queue connection lost'));
    expect(apiRedis).toHaveLength(1);
    expect(queue.length).toBeLessThanOrEqual(1);
  });
});
