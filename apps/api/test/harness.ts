import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '@carfax/db/testing';
import type { INestApplication, Type } from '@nestjs/common';
import type Redis from 'ioredis';
import request from 'supertest';
import { createApp } from '../src/app';
import { resetConfigForTests } from '../src/config';
import { MESSAGING, type MemorySender } from '../src/messaging/messaging.module';
import { REDIS } from '../src/redis/redis.module';

export interface TestApp {
  app: INestApplication;
  /** Supertest against the running app: http.get('/v1/health'). */
  http: ReturnType<typeof request>;
  /** The table owner's connection, for setting up data (bypasses row-level security). */
  db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
  /** The last login code "sent" to a phone (memory messaging provider). */
  lastCode(phone: string): string | undefined;
  /**
   * Signs a user in through the real code flow and returns a request helper that sends their
   * access token: `const { http, user } = await t.asUser(phone)`.
   */
  asUser(
    phone: string,
    audience?: 'garage' | 'web',
  ): Promise<{
    http: ReturnType<typeof request.agent>;
    accessToken: string;
    refreshToken: string;
    userId: string;
  }>;
  /**
   * Every log line the app wrote, as JSON strings. nestjs-pino keeps one root logger per process,
   * so when a file starts several apps, all their logs land in the first app's `logs`: assert on
   * logs in a file that starts one app.
   */
  logs: string[];
  close(): Promise<void>;
}

/**
 * Starts the real API for one test file (api/02): its own throwaway, migrated database (connected
 * as carfax_app, like production) and its own Redis key prefix, so test files run in parallel
 * without clashing. Logs go to `logs` instead of the terminal.
 */
export async function startTestApp(
  options: { imports?: Type[]; env?: Record<string, string> } = {},
): Promise<TestApp> {
  const database = await createTestDatabase({ migrated: true });
  const prefix = `test:${randomUUID()}:`;
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: String(database.app.pool.options.connectionString),
    REDIS_KEY_PREFIX: prefix,
    LOG_LEVEL: 'info',
    SENTRY_DSN: '',
    MESSAGING_PROVIDER: 'memory',
    JWT_SECRET: 'test-jwt-secret-0123456789-0123456789',
    OTP_SECRET: 'test-otp-secret-0123456789-0123456789',
    ...options.env,
  });
  resetConfigForTests();

  const logs: string[] = [];
  const app = await createApp({
    imports: options.imports,
    logStream: { write: (line: string) => void logs.push(line) },
  });
  await app.init();

  const http = request(app.getHttpServer());
  const lastCode = (phone: string) => app.get<MemorySender>(MESSAGING).lastCode(phone);
  const asUser: TestApp['asUser'] = async (phone, audience = 'garage') => {
    await http.post('/v1/auth/otp/request').send({ phone, audience }).expect(200);
    const res = await http
      .post('/v1/auth/otp/verify')
      .send({ phone, audience, code: lastCode(phone) })
      .expect(200);
    const agent = request
      .agent(app.getHttpServer())
      .set('authorization', `Bearer ${res.body.accessToken}`);
    return {
      http: agent,
      accessToken: res.body.accessToken,
      refreshToken: res.body.refreshToken,
      userId: res.body.user.id,
    };
  };

  return {
    app,
    http,
    lastCode,
    asUser,
    db: database.db,
    logs,
    async close() {
      // Remove this file's Redis keys. KEYS patterns aren't prefixed by ioredis, so match the full prefix.
      const redis = app.get<Redis>(REDIS);
      const keys = await redis.keys(`${prefix}*`).catch(() => []);
      if (keys.length) await redis.del(...keys.map((k) => k.slice(prefix.length)));
      await app.close();
      await database.drop();
    },
  };
}
