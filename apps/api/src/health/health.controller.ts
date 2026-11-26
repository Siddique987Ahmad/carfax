import type { Db } from '@carfax/db';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import type Redis from 'ioredis';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Public } from '../access/access.decorators';
import { DB } from '../db/db.module';
import { REDIS } from '../redis/redis.module';

const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({ database: z.enum(['up', 'down']), redis: z.enum(['up', 'down']) }),
});
class HealthDto extends createZodDto(HealthSchema) {}

const within = <T>(ms: number, promise: Promise<T>) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Up when the database and Redis both answer within 2 seconds; 503 otherwise. Used by hosting checks. */
  @Get()
  @Public()
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({ type: HealthDto })
  async check(@Res({ passthrough: true }) res: Response): Promise<z.infer<typeof HealthSchema>> {
    const [database, redis] = await Promise.all([
      within(2000, this.db.execute(sql`select 1`)).then(
        () => 'up' as const,
        () => 'down' as const,
      ),
      within(2000, this.redis.ping()).then(
        () => 'up' as const,
        () => 'down' as const,
      ),
    ]);
    const ok = database === 'up' && redis === 'up';
    res.status(ok ? 200 : 503);
    return { status: ok ? 'ok' : 'degraded', checks: { database, redis } };
  }
}
