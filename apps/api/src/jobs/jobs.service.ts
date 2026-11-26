import { type Db, schema, withGarage } from '@carfax/db';
import { FLAG_DESCRIPTIONS, type FlagCode } from '@carfax/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { GarageContext } from '../access/access.decorators';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';
import { StorageService } from '../storage/storage.module';

export const JOBS_PAGE_MAX = 100;

export interface JobListQuery {
  from?: string;
  to?: string;
  status?: 'draft' | 'submitted' | 'approved' | 'flagged' | 'rejected';
  carId?: string;
  cursor?: string;
  limit: number;
}

const encode = (serviceDate: string, id: string) =>
  Buffer.from(`${serviceDate}|${id}`).toString('base64url');
function decode(cursor: string): { serviceDate: string; id: string } {
  const [serviceDate, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (
    !serviceDate ||
    !id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) ||
    !/^[0-9a-f-]{36}$/i.test(id)
  ) {
    throw new AppError('BAD_REQUEST', 400, 'This cursor is not valid; list again without it');
  }
  return { serviceDate, id };
}

/**
 * The garage's jobs from the server (api/10), for a new phone or the owner's history screens; the
 * app otherwise reads its own database. Only the caller's garage (row-level security). A mechanic
 * sees prices only on jobs they logged, as in sync pull (api/09).
 */
@Injectable()
export class JobsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  private canSeePrices(garage: GarageContext, userId: string, createdBy: string) {
    return garage.role === 'owner' || createdBy === userId;
  }

  /** Newest first (service date, then id), paged with a cursor. */
  async list(garage: GarageContext, userId: string, q: JobListQuery) {
    const after = q.cursor ? decode(q.cursor) : null;
    const rows = await withGarage(this.db, garage.garageId, (tx) =>
      tx
        .select({
          id: schema.jobs.id,
          carId: schema.jobs.carId,
          regNo: schema.jobs.regNo,
          make: schema.cars.make,
          model: schema.cars.model,
          serviceDate: schema.jobs.serviceDate,
          odometerKm: schema.jobs.odometerKm,
          odometerNotWorking: schema.jobs.odometerNotWorking,
          status: schema.jobs.status,
          totalPkr: schema.jobs.totalPkr,
          customerName: schema.customers.name,
          createdBy: schema.jobs.createdBy,
          createdByName: schema.users.name,
          workTypes: sql<
            string[]
          >`coalesce((select array_agg(distinct i.work_type order by i.work_type)
            from job_items i where i.job_id = ${schema.jobs.id} and i.deleted_at is null), '{}')`,
        })
        .from(schema.jobs)
        .innerJoin(schema.cars, eq(schema.cars.id, schema.jobs.carId))
        .innerJoin(schema.users, eq(schema.users.id, schema.jobs.createdBy))
        .leftJoin(schema.customers, eq(schema.customers.id, schema.jobs.customerId))
        .where(
          and(
            eq(schema.jobs.garageId, garage.garageId),
            q.from ? sql`${schema.jobs.serviceDate} >= ${q.from}` : undefined,
            q.to ? sql`${schema.jobs.serviceDate} <= ${q.to}` : undefined,
            q.status ? eq(schema.jobs.status, q.status) : undefined,
            q.carId ? eq(schema.jobs.carId, q.carId) : undefined,
            after
              ? sql`(${schema.jobs.serviceDate}, ${schema.jobs.id}) < (${after.serviceDate}::date, ${after.id}::uuid)`
              : undefined,
          ),
        )
        .orderBy(desc(schema.jobs.serviceDate), desc(schema.jobs.id))
        .limit(q.limit + 1),
    );
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      jobs: page.map(({ createdBy, totalPkr, ...job }) => ({
        ...job,
        createdBy,
        totalPkr: this.canSeePrices(garage, userId, createdBy) ? totalPkr : null,
      })),
      nextCursor: rows.length > q.limit && last ? encode(last.serviceDate, last.id) : null,
    };
  }

  /** One job with its items, photos (short-lived links), flags in plain words and ops' notes. */
  async detail(garage: GarageContext, userId: string, jobId: string) {
    return withGarage(this.db, garage.garageId, async (tx) => {
      const [job] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
      if (!job) throw new AppError('NOT_FOUND', 404, 'Job not found'); // also another garage's job
      const prices = this.canSeePrices(garage, userId, job.createdBy);

      const [car] = await tx.select().from(schema.cars).where(eq(schema.cars.id, job.carId));
      const [customer] = job.customerId
        ? await tx.select().from(schema.customers).where(eq(schema.customers.id, job.customerId))
        : [];
      const [creator] = await tx
        .select({ name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, job.createdBy));
      const items = await tx
        .select()
        .from(schema.jobItems)
        .where(and(eq(schema.jobItems.jobId, jobId), sql`${schema.jobItems.deletedAt} is null`))
        .orderBy(schema.jobItems.createdAt);
      const photos = await tx
        .select()
        .from(schema.jobPhotos)
        .where(and(eq(schema.jobPhotos.jobId, jobId), sql`${schema.jobPhotos.deletedAt} is null`))
        .orderBy(schema.jobPhotos.takenAt);
      const flags = await tx
        .select()
        .from(schema.jobFlags)
        .where(eq(schema.jobFlags.jobId, jobId))
        .orderBy(schema.jobFlags.createdAt);
      const corrections = await tx
        .select()
        .from(schema.jobCorrectionRequests)
        .where(eq(schema.jobCorrectionRequests.jobId, jobId))
        .orderBy(desc(schema.jobCorrectionRequests.createdAt));
      // Ops' review decisions on this job (admin/10 records them in the audit log with a note).
      const reviews = await tx
        .select({
          action: schema.auditLogs.action,
          note: schema.auditLogs.note,
          at: schema.auditLogs.createdAt,
        })
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.entity, 'job'),
            eq(schema.auditLogs.entityId, jobId),
            inArray(schema.auditLogs.action, ['job.approve', 'job.reject', 'job.correct']),
          ),
        )
        .orderBy(schema.auditLogs.createdAt);

      return {
        id: job.id,
        status: job.status,
        serviceDate: job.serviceDate,
        regNo: job.regNo,
        odometerKm: job.odometerKm,
        odometerNotWorking: job.odometerNotWorking,
        nextServiceDueDate: job.nextServiceDueDate,
        nextServiceDueKm: job.nextServiceDueKm,
        notes: job.notes,
        totalPkr: prices ? job.totalPkr : null,
        createdBy: { id: job.createdBy, name: creator?.name ?? null },
        car: { id: car!.id, make: car!.make, model: car!.model, year: car!.year },
        customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
        items: items.map((i) => ({
          id: i.id,
          workType: i.workType,
          description: i.description,
          partName: i.partName,
          partPricePkr: prices ? i.partPricePkr : null,
          labourPricePkr: prices ? i.labourPricePkr : null,
        })),
        photos: await Promise.all(
          photos.map(async (p) => ({
            id: p.id,
            kind: p.kind,
            takenAt: p.takenAt.toISOString(),
            ocrReading: p.ocrReading,
            uploaded: p.uploadedAt !== null,
            // Valid for 5 minutes; the bucket itself is private.
            url:
              p.uploadedAt && p.storageKey
                ? await this.storage.signDownload(this.storage.photosBucket, p.storageKey)
                : null,
          })),
        ),
        flags: flags.map((f) => ({
          code: f.code,
          description: FLAG_DESCRIPTIONS[f.code as FlagCode] ?? f.code,
          raisedAt: f.createdAt.toISOString(),
          resolved: f.resolvedAt !== null,
        })),
        reviewNotes: reviews.map((r) => ({
          action: r.action,
          note: r.note,
          at: r.at.toISOString(),
        })),
        correctionRequests: corrections.map((c) => ({
          id: c.id,
          message: c.message,
          status: c.status,
          decisionNote: c.decisionNote,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    });
  }
}
