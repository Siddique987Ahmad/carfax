import { createHash } from 'node:crypto';
import { schema } from '@carfax/db';
import { eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REDIS } from '../src/redis/redis.module';
import { createUser, nextPhone } from './factories';
import { startTestApp, type TestApp } from './harness';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(async () => {
  await t?.close();
});

const request = (phone: string, audience = 'garage') =>
  t.http.post('/v1/auth/otp/request').send({ phone, audience });
const verify = (phone: string, code: string | undefined, audience = 'garage') =>
  t.http.post('/v1/auth/otp/verify').send({ phone, audience, code });
const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

describe('sign in with a code', () => {
  it('a new phone requests a code, verifies it and calls a protected route', async () => {
    const phone = nextPhone();
    const sent = await request(phone).expect(200);
    expect(sent.body).toEqual({ sent: true, expiresInSeconds: 300 });

    const res = await verify(phone, t.lastCode(phone)).expect(200);
    expect(res.body).toMatchObject({
      expiresIn: 900,
      user: { audience: 'garage', roles: [], garages: [] },
    });
    expect(res.body.refreshToken).toBeTruthy();

    const me = await t.http
      .get('/v1/auth/me')
      .set('authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ id: res.body.user.id, phone, roles: [] });
  });

  it('accepts any spelling of the phone and treats it as the same person', async () => {
    const phone = nextPhone(); // +92345xxxxxxx
    const local = `0${phone.slice(3, 6)}-${phone.slice(6)}`; // 0345-xxxxxxx
    await request(local).expect(200);
    const res = await verify(phone, t.lastCode(phone)).expect(200);
    const again = await t.asUser(phone);
    expect(again.userId).toBe(res.body.user.id);
  });

  it('a first login on the website makes the person a buyer', async () => {
    const phone = nextPhone();
    await request(phone, 'web').expect(200);
    const res = await verify(phone, t.lastCode(phone), 'web').expect(200);
    expect(res.body.user.roles).toEqual(['buyer']);
  });

  it('signs in an existing user with their roles and garage memberships', async () => {
    const user = await createUser(t.db, { roles: ['ops'] });
    const session = await t.asUser(user.phone);
    expect(session.userId).toBe(user.id);
    const me = await session.http.get('/v1/auth/me').expect(200);
    expect(me.body.roles).toEqual(['ops']);
  });

  it('refuses a disabled account, even with the right code', async () => {
    const user = await createUser(t.db);
    await t.db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, user.id));
    await request(user.phone).expect(200);
    const res = await verify(user.phone, t.lastCode(user.phone)).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses an invalid phone or code format', async () => {
    expect((await request('042-35761234').expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    expect((await verify(nextPhone(), '12345').expect(400)).body.error.code).toBe(
      'VALIDATION_FAILED',
    );
  });
});

describe('code rules', () => {
  it('a wrong code says how many tries are left; the 6th try is refused even with the right code', async () => {
    const phone = nextPhone();
    await request(phone).expect(200);
    const code = t.lastCode(phone)!;
    for (let left = 4; left >= 0; left--) {
      const res = await verify(phone, wrong(code)).expect(400);
      expect(res.body.error).toMatchObject({
        code: 'OTP_INVALID',
        details: { attemptsLeft: left },
      });
    }
    expect((await verify(phone, code).expect(400)).body.error.code).toBe('OTP_LOCKED');
    expect((await verify(phone, code).expect(400)).body.error.code).toBe('OTP_EXPIRED');
  });

  it('an expired code is refused', async () => {
    const phone = nextPhone();
    await request(phone).expect(200);
    await t.app.get<Redis>(REDIS).pexpire(`otp:garage:${phone}`, 1);
    await new Promise((r) => setTimeout(r, 20));
    expect((await verify(phone, t.lastCode(phone)).expect(400)).body.error.code).toBe(
      'OTP_EXPIRED',
    );
  });

  it('a code works once', async () => {
    const phone = nextPhone();
    await request(phone).expect(200);
    const code = t.lastCode(phone);
    await verify(phone, code).expect(200);
    expect((await verify(phone, code).expect(400)).body.error.code).toBe('OTP_EXPIRED');
  });

  it('two verifies at the same moment: only one signs in', async () => {
    const phone = nextPhone();
    await request(phone).expect(200);
    const code = t.lastCode(phone);
    const results = await Promise.all([
      verify(phone, code),
      verify(phone, code),
      verify(phone, code),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400]);
  });

  it('a code for the garage app does not work on the website', async () => {
    const phone = nextPhone();
    await request(phone, 'garage').expect(200);
    expect((await verify(phone, t.lastCode(phone), 'web').expect(400)).body.error.code).toBe(
      'OTP_EXPIRED',
    );
  });

  it('a new code replaces the old one', async () => {
    const phone = nextPhone();
    await request(phone).expect(200);
    const first = t.lastCode(phone)!;
    await request(phone).expect(200);
    if (first !== t.lastCode(phone)) {
      expect((await verify(phone, first).expect(400)).body.error.code).toBe('OTP_INVALID');
    }
    await verify(phone, t.lastCode(phone)).expect(200);
  });

  it('at most 3 codes per phone per 15 minutes', async () => {
    const phone = nextPhone();
    for (let i = 0; i < 3; i++) await request(phone).expect(200);
    const res = await request(phone).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(800);
  });
});

describe('tokens', () => {
  it('rejects a missing, tampered, foreign or expired access token', async () => {
    expect((await t.http.get('/v1/auth/me').expect(401)).body.error.details).toEqual({
      reason: 'missing',
    });
    const { accessToken } = await t.asUser(nextPhone());
    const tampered = `${accessToken.slice(0, -4)}AAAA`;
    await t.http.get('/v1/auth/me').set('authorization', `Bearer ${tampered}`).expect(401);
    const foreign = await new SignJWT({ roles: ['admin'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000000')
      .setAudience('garage')
      .setIssuer('carfax-api')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('someone-elses-secret-0123456789-0123456789'));
    await t.http.get('/v1/auth/me').set('authorization', `Bearer ${foreign}`).expect(401);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000000')
      .setAudience('garage')
      .setIssuer('carfax-api')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const res = await t.http
      .get('/v1/auth/me')
      .set('authorization', `Bearer ${expired}`)
      .expect(401);
    expect(res.body.error.details).toEqual({ reason: 'expired' });
  });

  it('a refresh token is replaced on every use', async () => {
    const { refreshToken: a } = await t.asUser(nextPhone());
    const r1 = await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(200);
    expect(r1.body.refreshToken).not.toBe(a);
    await t.http
      .get('/v1/auth/me')
      .set('authorization', `Bearer ${r1.body.accessToken}`)
      .expect(200);
  });

  it('reusing an old refresh token signs out every device in that session family', async () => {
    const { refreshToken: a } = await t.asUser(nextPhone());
    const b = (await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(200)).body
      .refreshToken;
    const c = (await t.http.post('/v1/auth/refresh').send({ refreshToken: b }).expect(200)).body
      .refreshToken;
    // `a` comes back after its replacement was used: it was copied.
    await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(401);
    // The thief's and the owner's latest tokens are both dead now.
    await t.http.post('/v1/auth/refresh').send({ refreshToken: c }).expect(401);
  });

  it('a quick retry after a lost response is allowed once, cancelling the unused replacement', async () => {
    const { refreshToken: a } = await t.asUser(nextPhone());
    // The app sends `a`, the server rotates it, but the response (with `lost`) never arrives.
    const lost = (await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(200)).body
      .refreshToken;
    // The app retries with `a` within the grace period: allowed.
    const retry = await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(200);
    // `lost` was cancelled (checked in the database: presenting it would itself count as theft).
    const hash = createHash('sha256').update(lost).digest('hex');
    const [row] = await t.db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, hash));
    expect(row!.revokedAt).not.toBeNull();
    // The retry's token works and rotates normally.
    await t.http
      .post('/v1/auth/refresh')
      .send({ refreshToken: retry.body.refreshToken })
      .expect(200);
  });

  it('a cancelled replacement showing up later is treated as theft', async () => {
    const { refreshToken: a } = await t.asUser(nextPhone());
    const lost = (await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(200)).body
      .refreshToken;
    const retry = (await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(200)).body
      .refreshToken;
    // Someone did receive `lost` after all: sign out the whole family.
    await t.http.post('/v1/auth/refresh').send({ refreshToken: lost }).expect(401);
    await t.http.post('/v1/auth/refresh').send({ refreshToken: retry }).expect(401);
  });

  it('no retry grace once the replacement has been used', async () => {
    const { refreshToken: a } = await t.asUser(nextPhone());
    const b = (await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(200)).body
      .refreshToken;
    await t.http.post('/v1/auth/refresh').send({ refreshToken: b }).expect(200);
    await t.http.post('/v1/auth/refresh').send({ refreshToken: a }).expect(401);
  });

  it('logout signs out this device', async () => {
    const { refreshToken } = await t.asUser(nextPhone());
    await t.http.post('/v1/auth/logout').send({ refreshToken }).expect(204);
    await t.http.post('/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('the website gets its refresh token in an httpOnly cookie and refreshes with it', async () => {
    const phone = nextPhone();
    await request(phone, 'web').expect(200);
    const res = await verify(phone, t.lastCode(phone), 'web').expect(200);
    expect(res.body.refreshToken).toBeUndefined();
    const cookie = res.headers['set-cookie']![0]!;
    expect(cookie).toMatch(/^carfax_refresh=[^;]+;/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/v1\/auth/);
    const refreshed = await t.http
      .post('/v1/auth/refresh')
      .set('cookie', cookie.split(';')[0]!)
      .send({})
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.headers['set-cookie']![0]).not.toBe(cookie);
  });
});

describe('no plain codes or tokens are stored or logged', () => {
  it('Redis keeps only an HMAC, the logs never see the code, and the database keeps only token hashes', async () => {
    const phone = nextPhone();
    t.logs.length = 0;
    await request(phone).expect(200);
    const code = t.lastCode(phone)!;
    const stored = await t.app.get<Redis>(REDIS).hgetall(`otp:garage:${phone}`);
    expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(code);

    const res = await verify(phone, code).expect(200);
    expect(t.logs.join('\n')).not.toContain(code);
    expect(t.logs.join('\n')).not.toContain(res.body.refreshToken);
    const tokens = await t.db.execute(sql`select token_hash from refresh_tokens`);
    expect(JSON.stringify(tokens.rows)).not.toContain(res.body.refreshToken);
  });
});
