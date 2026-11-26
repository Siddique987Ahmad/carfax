import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { getConfig } from '../config';

export const REDIS = Symbol('REDIS');
export const InjectRedis = () => Inject(REDIS);

/** One Redis connection for the API (OTP codes, rate limits). BullMQ makes its own (workers/01). */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => {
        const redis = new Redis(getConfig().REDIS_URL, {
          keyPrefix: getConfig().REDIS_KEY_PREFIX,
          // Connect on first use, so building the OpenAPI file needs no Redis.
          lazyConnect: true,
          // Fail a command quickly instead of retrying it many times while Redis is down.
          maxRetriesPerRequest: 1,
        });
        // ioredis reconnects by itself; log outages once each instead of an unhandled error per retry.
        const logger = new Logger('Redis');
        let down = false;
        redis.on('error', (error: Error) => {
          if (!down) logger.error(`connection lost (retrying): ${error.message}`);
          down = true;
        });
        redis.on('ready', () => {
          if (down) logger.log('connection back');
          down = false;
        });
        return redis;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    this.redis.disconnect();
  }
}
