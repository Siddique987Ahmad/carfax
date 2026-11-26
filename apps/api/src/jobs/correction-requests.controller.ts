import { type Db, schema, withGarage } from '@carfax/db';
import { CorrectionRequestSchema } from '@carfax/shared';
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { desc, eq } from 'drizzle-orm';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CurrentGarage,
  CurrentUser,
  type GarageContext,
  GaragePermission,
} from '../access/access.decorators';
import type { SessionUser } from '../auth/token.service';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';

class CreateCorrectionRequestDto extends createZodDto(CorrectionRequestSchema) {}

const CorrectionRequestViewSchema = z.object({
  id: z.uuid(),
  jobId: z.uuid(),
  message: z.string(),
  proposed: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(['open', 'approved', 'rejected']),
  decisionNote: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
class CorrectionRequestDto extends createZodDto(CorrectionRequestViewSchema) {}
class CorrectionRequestsDto extends createZodDto(z.array(CorrectionRequestViewSchema)) {}

type Row = typeof schema.jobCorrectionRequests.$inferSelect;
const view = (r: Row) => ({
  id: r.id,
  jobId: r.jobId,
  message: r.message,
  proposed: (r.proposed as Record<string, unknown> | null) ?? null,
  status: r.status,
  decisionNote: r.decisionNote,
  decidedAt: r.decidedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/** Unique violation: the job already has an open request (one per job). */
const isOpenRequestClash = (error: unknown) => {
  const e = error as {
    code?: string;
    cause?: { code?: string; constraint?: string };
    constraint?: string;
  };
  return (e.cause?.code ?? e.code) === '23505';
};

/**
 * Correction requests (api/08b): a garage asks ops to fix a mistake in a submitted job. The job
 * doesn't change until ops approve it in the admin panel (admin/12); the garage sees the outcome
 * on its next sync pull.
 */
@ApiTags('jobs')
@Controller('jobs/:jobId/correction-requests')
export class CorrectionRequestsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post()
  @GaragePermission('jobs.create')
  @ApiCreatedResponse({ type: CorrectionRequestDto })
  async create(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Body() body: CreateCorrectionRequestDto,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    try {
      return await withGarage(this.db, garage.garageId, async (tx) => {
        // Row-level security hides other garages' jobs, so theirs look like "not found".
        const [job] = await tx
          .select({ id: schema.jobs.id })
          .from(schema.jobs)
          .where(eq(schema.jobs.id, jobId));
        if (!job) throw new AppError('NOT_FOUND', 404, 'Job not found');
        const [request] = await tx
          .insert(schema.jobCorrectionRequests)
          .values({
            jobId,
            garageId: garage.garageId,
            requestedBy: user.id,
            message: body.message,
            proposed: body.proposed ?? null,
          })
          .returning();
        await tx.insert(schema.auditLogs).values({
          actorId: user.id,
          action: 'job.correction_request',
          entity: 'job',
          entityId: jobId,
          note: body.message,
          after: { requestId: request!.id, proposed: body.proposed ?? null },
        });
        return view(request!);
      });
    } catch (error) {
      if (isOpenRequestClash(error)) {
        throw new AppError(
          'CONFLICT',
          409,
          'This job already has a correction request waiting for review',
        );
      }
      throw error;
    }
  }

  @Get()
  @GaragePermission('jobs.view')
  @ApiOkResponse({ type: CorrectionRequestsDto })
  async list(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @CurrentGarage() garage: GarageContext,
  ) {
    const rows = await withGarage(this.db, garage.garageId, (tx) =>
      tx
        .select()
        .from(schema.jobCorrectionRequests)
        .where(eq(schema.jobCorrectionRequests.jobId, jobId))
        .orderBy(desc(schema.jobCorrectionRequests.createdAt)),
    );
    return rows.map(view);
  }
}
