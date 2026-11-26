import { type Db, schema, type Tx, withGarage, withSystem } from '@carfax/db';
import {
  canonicalCar,
  type SyncPush,
  type SyncRejectCode,
  type SyncWarningCode,
} from '@carfax/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { GarageContext } from '../access/access.decorators';
import { CarIdentityService } from '../cars/car-identity.service';
import { DB } from '../db/db.module';
import { QueueService } from '../queue/queue.module';
import { type NewJobForReminders, RemindersService } from '../reminders/reminders.service';
import { StorageService } from '../storage/storage.module';
import { MAX_PHOTO_BYTES, photoKey } from '../uploads/uploads.controller';

type Table = keyof SyncPush['changes'];
export interface PushResult {
  ok: true;
  /** Phone ids replaced by the server's: swap them on the phone, including in unsynced records. */
  remaps: { cars: Record<string, string>; customers: Record<string, string> };
  /** Records refused for good (resending won't help); everything else was saved. */
  rejected: { table: Table; id: string; code: SyncRejectCode }[];
  warnings: { table: Table; id: string; code: SyncWarningCode }[];
  /** How many jobs were new in this push (a resend saves 0). */
  newJobs: number;
}

const unique = <T>(items: T[]) => [...new Set(items)];
const pakistanToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const tomorrow = (isoDay: string) =>
  new Date(Date.parse(`${isoDay}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Saves a batch of offline work from the garage app (api/08), WatermelonDB style. The whole batch is
 * one transaction: all of it or none of it. Every record has a phone-made id, so a resend saves
 * nothing twice. Records that can never be accepted (a submitted job edited, an id owned by another
 * garage) are reported in `rejected` while the rest is saved, so one bad record can't block a
 * phone's sync forever. Malformed data (an app bug) fails validation before this runs.
 */
@Injectable()
export class SyncService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cars: CarIdentityService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly reminders: RemindersService,
  ) {}

  async push(garage: GarageContext, userId: string, { changes }: SyncPush): Promise<PushResult> {
    const garageId = garage.garageId;
    const rejected: PushResult['rejected'] = [];
    const warnings: PushResult['warnings'] = [];
    const reject = (table: Table, id: string, code: SyncRejectCode) =>
      rejected.push({ table, id, code });

    // Before the transaction: which job and photo ids already exist, and in which garage. Row-level
    // security hides other garages' rows inside the garage transaction, so this looks across all.
    const photos = [...changes.job_photos.created, ...changes.job_photos.updated];
    const jobIds = unique([
      ...changes.jobs.created.map((j) => j.id),
      ...changes.jobs.updated.map((j) => j.id),
      ...changes.jobs.deleted,
      ...changes.job_items.created.map((i) => i.job_id),
      ...photos.map((p) => p.job_id),
    ]);
    const photoIds = unique([...photos.map((p) => p.id), ...changes.job_photos.deleted]);
    const [knownJobs, knownPhotos] = await withSystem(this.db, async (tx) => [
      jobIds.length
        ? await tx
            .select({ id: schema.jobs.id, garageId: schema.jobs.garageId })
            .from(schema.jobs)
            .where(inArray(schema.jobs.id, jobIds))
        : [],
      photoIds.length
        ? await tx
            .select({
              id: schema.jobPhotos.id,
              jobId: schema.jobPhotos.jobId,
              garageId: schema.jobs.garageId,
            })
            .from(schema.jobPhotos)
            .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobPhotos.jobId))
            .where(inArray(schema.jobPhotos.id, photoIds))
        : [],
    ]);
    const jobGarage = new Map(knownJobs.map((j) => [j.id, j.garageId]));
    const photoOwner = new Map(knownPhotos.map((p) => [p.id, p]));

    // Which photo files are in storage (only for keys the server would have issued).
    const uploaded = new Set<string>();
    for (let i = 0; i < photos.length; i += 20) {
      await Promise.all(
        photos.slice(i, i + 20).map(async (p) => {
          const key = photoKey(garageId, p.job_id, p.id);
          if (p.storage_key !== key) return;
          const head = await this.storage.head(this.storage.photosBucket, key);
          if (head && head.size <= MAX_PHOTO_BYTES) uploaded.add(p.id);
        }),
      );
    }

    const latestServiceDate = tomorrow(pakistanToday()); // a day of slack for clocks and time zones

    const saved = await withGarage(this.db, garageId, async (tx) => {
      // 1. Cars (shared by all garages), through the one place cars are resolved (api/06).
      const carRemaps: Record<string, string> = {};
      for (const car of [...changes.cars.created, ...changes.cars.updated]) {
        const names = car.make
          ? canonicalCar(car.make, car.model)
          : { make: null, model: car.model ?? null };
        const result = await this.cars.resolveIn(
          tx,
          {
            id: car.id,
            regNo: car.reg_no,
            regYear: car.reg_year,
            chassisNo: car.chassis_no,
            make: names.make,
            model: names.model,
            year: car.year,
            differentCar: car.different_car,
          },
          userId,
        );
        if (result.remappedFrom) carRemaps[car.id] = result.carId;
      }

      // 2. Customers (this garage's own).
      const customerRemaps = await this.saveCustomers(tx, garageId, changes.customers, reject);

      // 3. Jobs. Submitted jobs are final from the app's side; ops correct them (admin/12).
      const itemsByJob = new Map<string, typeof changes.job_items.created>();
      for (const item of changes.job_items.created) {
        itemsByJob.set(item.job_id, [...(itemsByJob.get(item.job_id) ?? []), item]);
      }
      const createdIds = new Set(changes.jobs.created.map((j) => j.id));
      const acceptsChildren = new Set<string>(); // jobs saved in this push
      const newJobIds: string[] = [];
      const forReminders: NewJobForReminders[] = [];
      for (const job of [...changes.jobs.created, ...changes.jobs.updated]) {
        const owner = jobGarage.get(job.id);
        if (owner && owner !== garageId) {
          reject('jobs', job.id, 'JOB_CONFLICT');
          continue;
        }
        if (owner) {
          if (!createdIds.has(job.id)) reject('jobs', job.id, 'JOB_LOCKED'); // an edit after submit
          continue; // a resend of a job already saved
        }
        if (job.service_date > latestServiceDate) {
          reject('jobs', job.id, 'JOB_FUTURE_DATE');
          continue;
        }
        const items = itemsByJob.get(job.id) ?? [];
        if (items.length === 0) {
          reject('jobs', job.id, 'JOB_NO_ITEMS');
          continue;
        }
        const carId = carRemaps[job.car_id] ?? (await this.cars.resolveCarId(tx, job.car_id));
        if (!carId) {
          reject('jobs', job.id, 'JOB_UNKNOWN_CAR');
          continue;
        }
        let customerId = job.customer_id
          ? (customerRemaps[job.customer_id] ?? job.customer_id)
          : null;
        if (customerId) {
          const [known] = await tx
            .select({ id: schema.customers.id })
            .from(schema.customers)
            .where(eq(schema.customers.id, customerId));
          if (!known) {
            warnings.push({ table: 'jobs', id: job.id, code: 'CUSTOMER_UNKNOWN' });
            customerId = null;
          }
        }
        const inserted = await tx
          .insert(schema.jobs)
          .values({
            id: job.id,
            carId,
            garageId,
            customerId,
            createdBy: userId,
            regNo: job.reg_no ?? (await this.cars.currentPlate(tx, carId)),
            serviceDate: job.service_date,
            odometerKm: job.odometer_km ?? null,
            odometerNotWorking: job.odometer_not_working,
            // Worked out from the items, so it always matches them.
            totalPkr: items.reduce(
              (sum, i) => sum + (i.part_price_pkr ?? 0) + (i.labour_price_pkr ?? 0),
              0,
            ),
            notes: job.notes ?? null,
            status: 'submitted',
            nextServiceDueDate: job.next_service_due_date ?? null,
            nextServiceDueKm: job.next_service_due_km ?? null,
            deviceCreatedAt: job.device_created_at,
          })
          .onConflictDoNothing()
          .returning({ id: schema.jobs.id });
        acceptsChildren.add(job.id);
        if (inserted.length) {
          newJobIds.push(job.id); // empty: a simultaneous resend saved it first
          forReminders.push({
            id: job.id,
            carId,
            customerId,
            serviceDate: job.service_date,
            nextServiceDueDate: job.next_service_due_date ?? null,
            workTypes: [...new Set(items.map((i) => i.work_type))],
          });
        }
      }
      for (const id of changes.jobs.deleted) {
        if (jobGarage.get(id) === garageId) reject('jobs', id, 'JOB_LOCKED');
      }

      // 4. Work items: only with their new job; afterwards they're as final as the job.
      for (const item of changes.job_items.created) {
        if (acceptsChildren.has(item.job_id)) {
          await tx
            .insert(schema.jobItems)
            .values({
              id: item.id,
              jobId: item.job_id,
              workType: item.work_type,
              description: item.description ?? null,
              partName: item.part_name ?? null,
              partPricePkr: item.part_price_pkr ?? null,
              labourPricePkr: item.labour_price_pkr ?? null,
            })
            .onConflictDoNothing();
        } else if (jobGarage.get(item.job_id) === garageId) {
          const [known] = await tx
            .select({ id: schema.jobItems.id })
            .from(schema.jobItems)
            .where(eq(schema.jobItems.id, item.id));
          if (!known) reject('job_items', item.id, 'JOB_LOCKED'); // known: a resend
        } else {
          reject('job_items', item.id, 'PARENT_JOB_MISSING');
        }
      }
      for (const item of changes.job_items.updated) reject('job_items', item.id, 'JOB_LOCKED');
      for (const id of changes.job_items.deleted) reject('job_items', id, 'JOB_LOCKED');

      // 5. Photos: may be added to a saved job at any time (evidence only grows). A row can arrive
      // before its file; it's marked uploaded once the file is in storage (resend it after upload).
      for (const photo of photos) {
        const jobOk = acceptsChildren.has(photo.job_id) || jobGarage.get(photo.job_id) === garageId;
        if (!jobOk) {
          reject('job_photos', photo.id, 'PARENT_JOB_MISSING');
          continue;
        }
        const owner = photoOwner.get(photo.id);
        if (owner && (owner.garageId !== garageId || owner.jobId !== photo.job_id)) {
          reject('job_photos', photo.id, 'ID_CONFLICT');
          continue;
        }
        const key = photoKey(garageId, photo.job_id, photo.id);
        if (photo.storage_key && photo.storage_key !== key) {
          reject('job_photos', photo.id, 'PHOTO_KEY_INVALID');
          continue;
        }
        await tx
          .insert(schema.jobPhotos)
          .values({
            id: photo.id,
            jobId: photo.job_id,
            kind: photo.kind,
            storageKey: photo.storage_key ?? null,
            uploadedAt: uploaded.has(photo.id) ? new Date() : null,
            takenAt: photo.taken_at,
            ocrReading: photo.ocr_reading ?? null,
            lat: photo.lat ?? null,
            lng: photo.lng ?? null,
            gpsAccuracyM: photo.gps_accuracy_m ?? null,
          })
          .onConflictDoUpdate({
            target: schema.jobPhotos.id,
            // Only the upload state can change later; the evidence itself (time, place, reading) can't.
            set: {
              storageKey: sql`coalesce(${schema.jobPhotos.storageKey}, excluded.storage_key)`,
              uploadedAt: sql`coalesce(${schema.jobPhotos.uploadedAt}, excluded.uploaded_at)`,
            },
          });
      }
      for (const id of changes.job_photos.deleted) {
        if (photoOwner.get(id)?.garageId === garageId) reject('job_photos', id, 'PHOTO_LOCKED');
      }

      // 6. Reminders: returned, cancelled and created from the new jobs (api/13).
      await this.reminders.applyNewJobs(tx, garageId, forReminders);

      return { carRemaps, customerRemaps, newJobIds };
    });

    // After commit: ask the workers to check the new jobs. If this fails, they stay `submitted` and
    // the sweeper finds them (workers/02).
    await this.queue.enqueueFlagChecks(saved.newJobIds);

    return {
      ok: true,
      remaps: { cars: saved.carRemaps, customers: saved.customerRemaps },
      rejected,
      warnings,
      newJobs: saved.newJobIds.length,
    };
  }

  /**
   * Customers created on two phones with the same number become one: the second is remapped to the
   * first (the garage keeps one customer per phone). A lock per phone stops two pushes at once from
   * both creating it.
   */
  private async saveCustomers(
    tx: Tx,
    garageId: string,
    customers: SyncPush['changes']['customers'],
    reject: (table: Table, id: string, code: SyncRejectCode) => void,
  ): Promise<Record<string, string>> {
    const remaps: Record<string, string> = {};
    const phones = unique(
      [...customers.created, ...customers.updated]
        .map((c) => c.phone)
        .filter((p): p is string => Boolean(p)),
    ).sort();
    for (const phone of phones)
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`customer:${garageId}:${phone}`}))`,
      );

    for (const c of [...customers.created, ...customers.updated]) {
      const [byId] = await tx.select().from(schema.customers).where(eq(schema.customers.id, c.id));
      const samePhone = c.phone
        ? (
            await tx
              .select({ id: schema.customers.id })
              .from(schema.customers)
              .where(
                and(
                  eq(schema.customers.phone, c.phone),
                  isNull(schema.customers.deletedAt),
                  ne(schema.customers.id, c.id),
                ),
              )
          )[0]
        : undefined;
      if (byId) {
        if (samePhone) {
          reject('customers', c.id, 'CUSTOMER_PHONE_TAKEN');
          continue;
        }
        await tx
          .update(schema.customers)
          .set({ name: c.name ?? null, phone: c.phone ?? null })
          .where(eq(schema.customers.id, c.id));
        continue;
      }
      if (samePhone) {
        remaps[c.id] = samePhone.id;
        continue;
      }
      const inserted = await tx
        .insert(schema.customers)
        .values({ id: c.id, garageId, name: c.name ?? null, phone: c.phone ?? null })
        .onConflictDoNothing()
        .returning({ id: schema.customers.id });
      if (!inserted.length) reject('customers', c.id, 'ID_CONFLICT'); // the id exists in another garage
    }
    // Deleting a customer clears their name and phone; their jobs stay (api/11).
    if (customers.deleted.length) {
      await tx
        .update(schema.customers)
        .set({ deletedAt: new Date(), name: null, phone: null })
        .where(inArray(schema.customers.id, customers.deleted));
    }
    return remaps;
  }
}
