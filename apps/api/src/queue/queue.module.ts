import { QUEUES } from '@carfax/shared';
import { Global, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getConfig } from '../config';

/**
 * Adds background jobs for the workers (BullMQ). Best effort: the API never fails a request because
 * Redis is down. Anything missed is picked up by a sweeper (e.g. jobs still `submitted` after
 * 5 minutes get their flag check, workers/02).
 */
@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly logger = new Logger('Queue');
  private readonly connection = new Redis(getConfig().REDIS_URL, {
    // BullMQ needs this; and fail fast instead of queueing commands while Redis is down.
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
  private readonly flagChecks = new Queue(QUEUES.flagChecks, {
    connection: this.connection,
    // Tests give each file its own prefix, like the API's other Redis keys.
    prefix: `${getConfig().REDIS_KEY_PREFIX}bull`,
  });

  constructor() {
    let down = false;
    const onError = (error: Error) => {
      if (!down)
        this.logger.warn(`queue connection lost (jobs will be swept later): ${error.message}`);
      down = true;
    };
    this.connection.on('error', onError);
    this.flagChecks.on('error', onError);
    this.connection.on('ready', () => (down = false));
  }

  /** Asks the workers to check these jobs. One queue entry per job id, so a resend adds nothing. */
  async enqueueFlagChecks(jobIds: string[]): Promise<void> {
    if (jobIds.length === 0) return;
    try {
      await Promise.race([
        this.flagChecks.addBulk(
          jobIds.map((jobId) => ({
            name: 'check-job',
            data: { jobId },
            opts: { jobId, removeOnComplete: 1000 },
          })),
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);
    } catch (error) {
      this.logger.warn(
        `couldn't queue flag checks for ${jobIds.length} job(s); the sweeper will: ${(error as Error).message}`,
      );
    }
  }

  async onApplicationShutdown() {
    await this.flagChecks.close().catch(() => {});
    this.connection.disconnect();
  }
}

@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
