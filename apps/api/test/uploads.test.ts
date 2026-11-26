import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from '../src/storage/storage.module';
import { MAX_PHOTO_BYTES } from '../src/uploads/uploads.controller';
import { createCar, createGarage, createJob } from './factories';
import { startTestApp, type TestApp } from './harness';

// Uploads go to real S3-compatible storage: SeaweedFS locally (pnpm services:up) and in CI.
let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let B: Awaited<ReturnType<typeof createGarage>>;
let ownerA: Awaited<ReturnType<TestApp['asUser']>>['http'];
beforeAll(async () => {
  t = await startTestApp();
  A = await createGarage(t.db, { name: 'A Motors' });
  B = await createGarage(t.db, { name: 'B Motors' });
  ownerA = (await t.asUser(A.owner.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

/** A small fake JPEG of the given size (starts with the JPEG marker). */
const jpeg = (size: number) => {
  const bytes = Buffer.alloc(size, 7);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  return bytes;
};

const sign = (body: Record<string, unknown>, http = ownerA) =>
  http.post('/v1/uploads/sign').send({
    jobId: randomUUID(),
    photoId: randomUUID(),
    kind: 'odometer',
    contentType: 'image/jpeg',
    size: 1000,
    ...body,
  });

const put = (url: string, body: Buffer, contentType = 'image/jpeg') =>
  fetch(url, { method: 'PUT', body, headers: { 'content-type': contentType } });

describe('uploading a photo', () => {
  it('the app uploads with the signed URL, and the file is private', async () => {
    const photo = jpeg(1500);
    const jobId = randomUUID();
    const photoId = randomUUID();
    const res = await sign({ jobId, photoId, size: photo.length }).expect(200);
    expect(res.body.storageKey).toBe(`jobs/${A.garage.id}/${jobId}/${photoId}.jpg`);
    expect(res.body.headers).toEqual({ 'content-type': 'image/jpeg', 'content-length': '1500' });

    const upload = await put(res.body.uploadUrl, photo);
    expect(upload.status).toBe(200);

    const storage = t.app.get(StorageService);
    expect(await storage.head(storage.photosBucket, res.body.storageKey)).toEqual({
      size: 1500,
      contentType: 'image/jpeg',
    });
    // Readable only through a signed URL.
    const signedGet = await fetch(
      await storage.signDownload(storage.photosBucket, res.body.storageKey),
    );
    expect(Buffer.from(await signedGet.arrayBuffer()).equals(photo)).toBe(true);
    const unsigned = await fetch(
      new URL(res.body.uploadUrl).origin + new URL(res.body.uploadUrl).pathname,
    );
    expect(unsigned.ok).toBe(false);
  });

  it('a bigger or different file than the one signed for is refused by storage', async () => {
    const res = await sign({ size: 1000 }).expect(200);
    expect((await put(res.body.uploadUrl, jpeg(1001))).ok).toBe(false);
    expect((await put(res.body.uploadUrl, jpeg(999))).ok).toBe(false);
    expect((await put(res.body.uploadUrl, jpeg(1000), 'image/png')).ok).toBe(false);
  });

  it('an altered URL is refused: another key, or a changed signature', async () => {
    const res = await sign({ size: 1000 }).expect(200);
    const url = new URL(res.body.uploadUrl);
    const otherKey = new URL(url);
    otherKey.pathname = url.pathname.replace(A.garage.id, B.garage.id);
    expect((await put(otherKey.toString(), jpeg(1000))).ok).toBe(false);
    const badSignature = new URL(url);
    const sig = badSignature.searchParams.get('X-Amz-Signature')!;
    badSignature.searchParams.set(
      'X-Amz-Signature',
      `${sig.slice(0, -1)}${sig.endsWith('0') ? '1' : '0'}`,
    );
    expect((await put(badSignature.toString(), jpeg(1000))).ok).toBe(false);
  });

  it('an expired URL is refused', async () => {
    const storage = t.app.get(StorageService);
    const url = await storage.signUpload(
      storage.photosBucket,
      `jobs/${A.garage.id}/expired/${randomUUID()}.jpg`,
      'image/jpeg',
      1000,
      1,
    );
    await new Promise((r) => setTimeout(r, 2100));
    expect((await put(url, jpeg(1000))).ok).toBe(false);
  });
});

describe('what may be signed', () => {
  it('files over 2 MB or not JPEG are refused', async () => {
    expect((await sign({ size: MAX_PHOTO_BYTES + 1 }).expect(400)).body.error.code).toBe(
      'VALIDATION_FAILED',
    );
    await sign({ contentType: 'image/png' }).expect(400);
    await sign({ size: 0 }).expect(400);
    await sign({ kind: 'selfie' }).expect(400);
  });

  it("a garage can't get a URL for another garage's job", async () => {
    const { car } = await createCar(t.db);
    const bJob = await createJob(t.db, {
      garageId: B.garage.id,
      carId: car.id,
      createdBy: B.owner.id,
    });
    expect((await sign({ jobId: bJob.id }).expect(403)).body.error.code).toBe('FORBIDDEN');
  });

  it('a garage can sign for its own synced job, and for a job not synced yet', async () => {
    const { car } = await createCar(t.db);
    const aJob = await createJob(t.db, {
      garageId: A.garage.id,
      carId: car.id,
      createdBy: A.owner.id,
    });
    await sign({ jobId: aJob.id }).expect(200);
    await sign({ jobId: randomUUID() }).expect(200);
  });

  it('a pending or suspended garage gets no upload URLs, and signing needs a sign-in', async () => {
    const pending = (await t.asUser((await createGarage(t.db, { status: 'pending' })).owner.phone))
      .http;
    expect((await sign({}, pending).expect(403)).body.error.code).toBe('GARAGE_PENDING');
    await t.http.post('/v1/uploads/sign').send({}).expect(401);
  });
});
