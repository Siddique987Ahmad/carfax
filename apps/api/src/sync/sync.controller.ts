import { SYNC_REJECT_CODES, SYNC_WARNING_CODES, SyncPushSchema } from '@carfax/shared';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CurrentGarage,
  CurrentUser,
  type GarageContext,
  GaragePermission,
} from '../access/access.decorators';
import type { SessionUser } from '../auth/token.service';
import { SyncPullService } from './sync-pull.service';
import { SyncService } from './sync.service';

class SyncPushDto extends createZodDto(SyncPushSchema) {}
class SyncPullQueryDto extends createZodDto(
  z.object({
    last_pulled_at: z.coerce
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('The timestamp from the last complete pull; empty on a new phone'),
    cursor: z
      .string()
      .max(2000)
      .optional()
      .describe('From the previous page, while hasMore is true'),
  }),
) {}
const PulledTableSchema = z.object({
  created: z.array(z.never()),
  updated: z.array(z.record(z.string(), z.unknown())),
  deleted: z.array(z.uuid()),
});
class SyncPullDto extends createZodDto(
  z.object({
    changes: z.object({
      customers: PulledTableSchema,
      jobs: PulledTableSchema,
      job_items: PulledTableSchema,
      job_photos: PulledTableSchema,
      reminders: PulledTableSchema,
      cars: PulledTableSchema,
    }),
    timestamp: z.number(),
    hasMore: z.boolean(),
    cursor: z.string().optional(),
  }),
) {}

const TableSchema = z.enum(['cars', 'customers', 'jobs', 'job_items', 'job_photos']);
class PushResultDto extends createZodDto(
  z.object({
    ok: z.literal(true),
    remaps: z.object({
      cars: z.record(z.string(), z.uuid()),
      customers: z.record(z.string(), z.uuid()),
    }),
    rejected: z.array(
      z.object({ table: TableSchema, id: z.uuid(), code: z.enum(SYNC_REJECT_CODES) }),
    ),
    warnings: z.array(
      z.object({ table: TableSchema, id: z.uuid(), code: z.enum(SYNC_WARNING_CODES) }),
    ),
    newJobs: z.number(),
  }),
) {}

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly pullService: SyncPullService,
  ) {}

  /**
   * What changed in this garage since `last_pulled_at` (WatermelonDB pull format; every change is in
   * `updated`, so use `sendCreatedAsUpdated`). Page with `cursor` while `hasMore`, then keep
   * `timestamp` for next time. A new phone gets the last 12 months.
   */
  @Get('pull')
  @GaragePermission('jobs.view')
  @ApiOkResponse({ type: SyncPullDto })
  pull(
    @Query() query: SyncPullQueryDto,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    return this.pullService.pull(garage, user.id, query.last_pulled_at ?? null, query.cursor);
  }

  /**
   * Saves the garage app's offline work in one transaction (WatermelonDB push format). Safe to
   * resend. At most 50 jobs per push. Apply `remaps` on the phone; `rejected` records won't ever be
   * accepted, so stop resending them.
   */
  @Post('push')
  @HttpCode(200)
  @GaragePermission('jobs.create')
  @ApiOkResponse({ type: PushResultDto })
  push(
    @Body() body: SyncPushDto,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    return this.sync.push(garage, user.id, body);
  }
}
