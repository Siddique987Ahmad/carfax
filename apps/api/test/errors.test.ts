import { ApiErrorSchema } from '@carfax/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './harness';
import { TestRoutesModule } from './test-routes';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp({ imports: [TestRoutesModule] });
});
afterAll(async () => {
  await t?.close();
});

describe('error format', () => {
  it('an invalid body returns 400 VALIDATION_FAILED with paths, never the submitted values', async () => {
    const res = await t.http
      .post('/v1/test/sign-up')
      .send({ phone: '042-35761234', name: 'A' })
      .expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'name',
      'phone',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('35761234');
  });

  it('a valid body passes, normalised by the shared schema', async () => {
    const res = await t.http
      .post('/v1/test/sign-up')
      .send({ phone: '0300-1234567', name: 'Ali' })
      .expect(201);
    expect(res.body).toEqual({ ok: true, phone: '+923001234567' });
  });

  it('an unknown route returns 404 NOT_FOUND', async () => {
    const res = await t.http.get('/v1/nope').expect(404);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('an AppError keeps its code, status and details', async () => {
    const res = await t.http.get('/v1/test/conflict').expect(409);
    expect(res.body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'That garage already exists',
      details: { field: 'name' },
    });
  });

  it('a crash returns a generic 500 that leaks nothing, with the request id', async () => {
    const res = await t.http
      .get('/v1/test/crash')
      .set('x-request-id', 'support-ticket-0001')
      .expect(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong. Quote the request id to support.',
        requestId: 'support-ticket-0001',
      },
    });
    expect(res.headers['x-request-id']).toBe('support-ticket-0001');
  });

  it('an unsafe incoming request id is replaced', async () => {
    const res = await t.http.get('/v1/nope').set('x-request-id', '<script>');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });
});

describe('logging', () => {
  it('no phone number reaches the log: not from the query, the body or an error message', async () => {
    t.logs.length = 0;
    await t.http.get('/v1/test/crash?phone=03451112233').set('x-request-id', 'log-check-0001');
    await t.http.post('/v1/test/sign-up').send({ phone: '0345 111 2233', name: 'Ali' });
    const all = t.logs.join('\n');
    expect(all).toContain('log-check-0001'); // the logs really were captured
    expect(all).toContain('[phone]'); // the error message was scrubbed, not dropped
    expect(all).not.toMatch(/345\s?111\s?2233/);
    expect(all).not.toMatch(/451112233/);
  });

  it('request bodies are never logged', async () => {
    t.logs.length = 0;
    await t.http.post('/v1/test/sign-up').send({ phone: '03001234567', name: 'Unmistakable Name' });
    expect(t.logs.join('\n')).not.toContain('Unmistakable Name');
  });
});
