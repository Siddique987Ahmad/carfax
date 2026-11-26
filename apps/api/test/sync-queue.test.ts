import { randomUUID } from 'node:crypto';
import { schema } from '@carfax/db';
import type { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { QueueService } from '../src/queue/queue.module';
import { createGarage, nextPlate } from './factories';
import { startTestApp, type TestApp } from './harness';

// Its own file, because it reads this app's logs (see harness.ts).
let t: TestApp;
let http: Awaited<ReturnType<TestApp['asUser']>>['http'];
let queue: Queue;
beforeAll(async () => {
  t = await startTestApp();
  http = (await t.asUser((await createGarage(t.db)).owner.phone)).http;
  queue = (t.app.get(QueueService) as unknown as { flagChecks: Queue }).flagChecks;
});
afterAll(async () => {
  await t?.close();
});

function oneJob() {
  const car = randomUUID();
  const job = randomUUID();
  return {
    job,
    body: {
      changes: {
        cars: { created: [{ id: car, reg_no: nextPlate() }] },
        jobs: {
          created: [
            {
              id: job,
              car_id: car,
              service_date: '2026-11-20',
              odometer_km: 1000,
              device_created_at: Date.now(),
            },
          ],
        },
        job_items: { created: [{ id: randomUUID(), job_id: job, work_type: 'oil_change' }] },
      },
    },
  };
}

describe('flag checks for new jobs', () => {
  it('each new job is queued once for its flag check; a resend queues nothing new', async () => {
    const { job, body } = oneJob();
    await http.post('/v1/sync/push').send(body).expect(200);
    await http.post('/v1/sync/push').send(body).expect(200);
    const queued = await queue.getJob(job);
    expect(queued?.data).toEqual({ jobId: job });
    expect(await queue.getJobCountByTypes('waiting', 'delayed', 'prioritized')).toBe(1);
  });

  it('when queueing fails, the push still succeeds and the job stays submitted for the sweeper', async () => {
    const spy = vi.spyOn(queue, 'addBulk').mockRejectedValueOnce(new Error('Redis is down'));
    const { job, body } = oneJob();
    const res = await http.post('/v1/sync/push').send(body).expect(200);
    expect(res.body.newJobs).toBe(1);
    const [row] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, job));
    expect(row!.status).toBe('submitted');
    expect(t.logs.join('\n')).toContain("couldn't queue flag checks");
    spy.mockRestore();
  });
});
