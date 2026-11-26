import { JOB_STATUSES } from '@carfax/shared';
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
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
import { JOBS_PAGE_MAX, JobsService } from './jobs.service';

class JobListQueryDto extends createZodDto(
  z
    .object({
      from: z.iso.date().optional().describe('Service date from (inclusive)'),
      to: z.iso.date().optional().describe('Service date to (inclusive)'),
      status: z.enum(JOB_STATUSES).optional(),
      carId: z.uuid().optional(),
      cursor: z.string().max(200).optional().describe('nextCursor from the previous page'),
      limit: z.coerce.number().int().min(1).max(JOBS_PAGE_MAX).default(50),
    })
    .refine((q) => !q.from || !q.to || q.from <= q.to, {
      message: '`from` must not be after `to`',
      path: ['from'],
    }),
) {}

const JobSummarySchema = z.object({
  id: z.uuid(),
  carId: z.uuid(),
  regNo: z.string().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  serviceDate: z.iso.date(),
  odometerKm: z.number().nullable(),
  odometerNotWorking: z.boolean(),
  status: z.enum(JOB_STATUSES),
  /** Null for a mechanic on someone else's job. */
  totalPkr: z.number().nullable(),
  customerName: z.string().nullable(),
  createdBy: z.uuid(),
  createdByName: z.string().nullable(),
  workTypes: z.array(z.string()),
});
class JobListDto extends createZodDto(
  z.object({ jobs: z.array(JobSummarySchema), nextCursor: z.string().nullable() }),
) {}

class JobDetailDto extends createZodDto(
  z.object({
    id: z.uuid(),
    status: z.enum(JOB_STATUSES),
    serviceDate: z.iso.date(),
    regNo: z.string().nullable(),
    odometerKm: z.number().nullable(),
    odometerNotWorking: z.boolean(),
    nextServiceDueDate: z.iso.date().nullable(),
    nextServiceDueKm: z.number().nullable(),
    notes: z.string().nullable(),
    totalPkr: z.number().nullable(),
    createdBy: z.object({ id: z.uuid(), name: z.string().nullable() }),
    car: z.object({
      id: z.uuid(),
      make: z.string().nullable(),
      model: z.string().nullable(),
      year: z.number().nullable(),
    }),
    customer: z
      .object({ id: z.uuid(), name: z.string().nullable(), phone: z.string().nullable() })
      .nullable(),
    items: z.array(
      z.object({
        id: z.uuid(),
        workType: z.string(),
        description: z.string().nullable(),
        partName: z.string().nullable(),
        partPricePkr: z.number().nullable(),
        labourPricePkr: z.number().nullable(),
      }),
    ),
    photos: z.array(
      z.object({
        id: z.uuid(),
        kind: z.enum(['odometer', 'before', 'after']),
        takenAt: z.iso.datetime(),
        ocrReading: z.number().nullable(),
        uploaded: z.boolean(),
        /** A 5-minute link to the photo; null until the file is uploaded. */
        url: z.string().nullable(),
      }),
    ),
    flags: z.array(
      z.object({
        code: z.string(),
        description: z.string(),
        raisedAt: z.iso.datetime(),
        resolved: z.boolean(),
      }),
    ),
    reviewNotes: z.array(
      z.object({ action: z.string(), note: z.string().nullable(), at: z.iso.datetime() }),
    ),
    correctionRequests: z.array(
      z.object({
        id: z.uuid(),
        message: z.string(),
        status: z.string(),
        decisionNote: z.string().nullable(),
        createdAt: z.iso.datetime(),
      }),
    ),
  }),
) {}

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** The garage's jobs, newest first. Filters: service date range, status, car. Paged with `cursor`. */
  @Get()
  @GaragePermission('jobs.view')
  @ApiOkResponse({ type: JobListDto })
  list(
    @Query() query: JobListQueryDto,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    return this.jobs.list(garage, user.id, query);
  }

  /** One job: items, photos (5-minute links), flags in plain words, ops' review notes, correction requests. */
  @Get(':id')
  @GaragePermission('jobs.view')
  @ApiOkResponse({ type: JobDetailDto })
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    return this.jobs.detail(garage, user.id, id);
  }
}
