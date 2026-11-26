import { SYNC_REJECT_CODES, SYNC_WARNING_CODES, SyncPushSchema } from '@carfax/shared';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
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
import { SyncService } from './sync.service';

class SyncPushDto extends createZodDto(SyncPushSchema) {}

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
  constructor(private readonly sync: SyncService) {}

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
