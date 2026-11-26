import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REDIS } from '../src/redis/redis.module';
import { startTestApp, type TestApp } from './harness';

// Two apps side by side, as parallel test files would run.
let a: TestApp;
let b: TestApp;
beforeAll(async () => {
  a = await startTestApp();
  b = await startTestApp();
});
afterAll(async () => {
  await a?.close();
  await b?.close();
});

describe('test isolation', () => {
  it('each app has its own database', async () => {
    const name = async (t: TestApp) =>
      (await t.db.execute(sql`select current_database() as n`)).rows[0]!.n;
    expect(await name(a)).not.toBe(await name(b));
  });

  it("each app has its own Redis keys: one can't see the other's", async () => {
    await a.app.get<Redis>(REDIS).set('otp:+923001234567', 'from-a');
    expect(await b.app.get<Redis>(REDIS).get('otp:+923001234567')).toBeNull();
    expect(await a.app.get<Redis>(REDIS).get('otp:+923001234567')).toBe('from-a');
  });

  it('the app connects as carfax_app, never as the table owner', async () => {
    const health = await a.http.get('/v1/health').expect(200);
    expect(health.body.checks.database).toBe('up');
    expect(a.logs.join('\n')).toContain('connected as carfax_app');
  });
});
