import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
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
      useFactory: () =>
        new Redis(getConfig().REDIS_URL, {
          // Connect on first use, so building the OpenAPI file needs no Redis.
          lazyConnect: true,
          // Fail a command quickly instead of retrying it many times while Redis is down.
          maxRetriesPerRequest: 1,
        }),
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
