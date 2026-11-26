import { type Db, type Tx, withGarage } from '@carfax/db';
import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { GarageContext } from '../access/access.decorators';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';

/** Rows per page, all tables together. */
export const PULL_PAGE_SIZE = 1000;
/** The returned timestamp is this much before the window's end, so a change still being saved
 * while a phone syncs isn't skipped forever (db/03): the next pull asks from there again. */
export const PULL_OVERLAP_MS = 60_000;
/** A new phone gets the last 12 months. */
export const FIRST_SYNC_DAYS = 365;

const TABLES = [
  'customers',
  'jobs',
  'job_items',
  'job_photos',
  'reminders',
  'job_correction_requests',
  'cars',
] as const;
type PullTable = (typeof TABLES)[number];
type Row = Record<string, unknown> & { id: string; ua: string | null; deleted?: boolean };

export interface PullCursor {
  /** Window start (ms), null on a first sync. */
  s: number | null;
  /** Window end: the database's clock when the first page was asked for, exact. */
  u: string;
  /** Which table, and the last row given (its exact updated_at and id). */
  t: number;
  a: string | null;
  i: string | null;
}

export interface PullResult {
  changes: Record<
    PullTable,
    { created: never[]; updated: Record<string, unknown>[]; deleted: string[] }
  >;
  /** Give this back as `last_pulled_at` next time (after the last page). */
  timestamp: number;
  hasMore: boolean;
  /** Ask again with this until `hasMore` is false. */
  cursor?: string;
}

const encode = (c: PullCursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(raw: string): PullCursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as PullCursor;
    if (typeof c.u !== 'string' || typeof c.t !== 'number' || c.t < 0 || c.t >= TABLES.length)
      throw new Error();
    if (Number.isNaN(Date.parse(c.u)) || (c.a !== null && Number.isNaN(Date.parse(c.a))))
      throw new Error();
    return c;
  } catch {
    throw new AppError('BAD_REQUEST', 400, 'This sync cursor is not valid; pull again without it');
  }
}

// Milliseconds as a plain number. Not ::bigint: node-postgres returns bigint as a string, and
// WatermelonDB needs numbers for its date columns (found in api/08b). Millisecond times fit
// exactly in a JavaScript number until the year 287,396.
const ms = (column: string) => sql.raw(`floor(extract(epoch from ${column}) * 1000)::float8`);

/**
 * What changed in the caller's garage since the phone's last pull (api/09), in WatermelonDB's
 * format. Every changed record goes in `updated` (the app uses `sendCreatedAsUpdated`), because the
 * overlap can send a record twice. Only this garage's data, through row-level security; cars only
 * when the garage has a job on them.
 */
@Injectable()
export class SyncPullService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async pull(
    garage: GarageContext,
    userId: string,
    lastPulledAt: number | null,
    rawCursor?: string,
  ): Promise<PullResult> {
    return withGarage(this.db, garage.garageId, async (tx) => {
      let cursor: PullCursor;
      if (rawCursor) {
        cursor = decode(rawCursor);
      } else {
        const [{ now }] = (await tx.execute(sql`select now()::text as now`)).rows as [
          { now: string },
        ];
        cursor = { s: lastPulledAt, u: now, t: 0, a: null, i: null };
      }
      const firstSync = cursor.s === null;
      const since = firstSync
        ? sql`(${cursor.u}::timestamptz - make_interval(days => ${FIRST_SYNC_DAYS}))`
        : sql`to_timestamp(${cursor.s! / 1000})`;
      const until = sql`${cursor.u}::timestamptz`;

      const changes = Object.fromEntries(
        TABLES.map((t) => [
          t,
          {
            created: [] as never[],
            updated: [] as Record<string, unknown>[],
            deleted: [] as string[],
          },
        ]),
      ) as unknown as PullResult['changes'];
      let budget = PULL_PAGE_SIZE;
      // Mechanics see prices only on the jobs they logged themselves (garage-app/14).
      const hidePricesOf = garage.role === 'owner' ? null : userId;

      for (let t = cursor.t; t < TABLES.length; t++) {
        const table = TABLES[t]!;
        const after = t === cursor.t && cursor.i ? { a: cursor.a, i: cursor.i } : null;
        const rows = await this.rows(
          tx,
          table,
          garage.garageId,
          since,
          until,
          after,
          budget + 1,
          hidePricesOf,
        );
        const page = rows.slice(0, budget);
        for (const row of page) {
          const { ua: _ua, deleted, ...record } = row;
          if (deleted) {
            if (!firstSync) changes[table].deleted.push(record.id);
          } else {
            changes[table].updated.push(record);
          }
        }
        budget -= page.length;
        if (rows.length > page.length) {
          const last = page[page.length - 1]!;
          return {
            changes,
            timestamp: this.timestamp(cursor),
            hasMore: true,
            // Cars page by id only, so they carry no timestamp.
            cursor: encode({ ...cursor, t, a: last.ua || null, i: last.id }),
          };
        }
      }
      return { changes, timestamp: this.timestamp(cursor), hasMore: false };
    });
  }

  private timestamp(cursor: PullCursor) {
    return Date.parse(cursor.u) - PULL_OVERLAP_MS;
  }

  /** One table's changed rows in the window, in a fixed order, after the cursor's position. */
  private async rows(
    tx: Tx,
    table: PullTable,
    garageId: string,
    since: SQL,
    until: SQL,
    after: { a: string | null; i: string } | null,
    limit: number,
    hidePricesOf: string | null,
  ): Promise<Row[]> {
    const window = (col: string) => sql`${sql.raw(col)} > ${since} and ${sql.raw(col)} <= ${until}`;
    const keyset = (col: string) =>
      after ? sql`and (${sql.raw(col)}, id) > (${after.a}::timestamptz, ${after.i}::uuid)` : sql``;
    const order = (col: string) => sql`order by ${sql.raw(col)}, id limit ${limit}`;
    let query: SQL;
    switch (table) {
      case 'customers':
        query = sql`select id, name, phone, deleted_at is not null as deleted, updated_at::text as ua
          from customers where garage_id = ${garageId} and ${window('updated_at')} ${keyset('updated_at')} ${order('updated_at')}`;
        break;
      case 'jobs':
        query = sql`select id, car_id, customer_id, reg_no, service_date::text, odometer_km, odometer_not_working,
            case when ${hidePricesOf}::uuid is null or created_by = ${hidePricesOf}::uuid then total_pkr end as total_pkr,
            notes, status, next_service_due_date::text, next_service_due_km, created_by,
            ${ms('device_created_at')} as device_created_at, ${ms('synced_at')} as synced_at, updated_at::text as ua
          from jobs where garage_id = ${garageId} and ${window('updated_at')} ${keyset('updated_at')} ${order('updated_at')}`;
        break;
      case 'job_items':
        query = sql`select i.id, i.job_id, i.work_type, i.description, i.part_name,
            case when ${hidePricesOf}::uuid is null or j.created_by = ${hidePricesOf}::uuid then i.part_price_pkr end as part_price_pkr,
            case when ${hidePricesOf}::uuid is null or j.created_by = ${hidePricesOf}::uuid then i.labour_price_pkr end as labour_price_pkr,
            i.deleted_at is not null as deleted, i.updated_at::text as ua
          from job_items i join jobs j on j.id = i.job_id
          where j.garage_id = ${garageId} and ${window('i.updated_at')}
            ${after ? sql`and (i.updated_at, i.id) > (${after.a}::timestamptz, ${after.i}::uuid)` : sql``}
          order by i.updated_at, i.id limit ${limit}`;
        break;
      case 'job_photos':
        query = sql`select p.id, p.job_id, p.kind, p.storage_key, p.uploaded_at is not null as uploaded,
            ${ms('p.taken_at')} as taken_at, p.ocr_reading, p.lat::float8 as lat, p.lng::float8 as lng, p.gps_accuracy_m,
            p.deleted_at is not null as deleted, p.updated_at::text as ua
          from job_photos p join jobs j on j.id = p.job_id
          where j.garage_id = ${garageId} and ${window('p.updated_at')}
            ${after ? sql`and (p.updated_at, p.id) > (${after.a}::timestamptz, ${after.i}::uuid)` : sql``}
          order by p.updated_at, p.id limit ${limit}`;
        break;
      case 'reminders':
        query = sql`select id, car_id, customer_id, source_job_id, kind, due_date::text, status,
            ${ms('sent_at')} as sent_at, returned_job_id, deleted_at is not null as deleted, updated_at::text as ua
          from reminders where garage_id = ${garageId} and ${window('updated_at')} ${keyset('updated_at')} ${order('updated_at')}`;
        break;
      case 'job_correction_requests':
        query = sql`select id, job_id, requested_by, message, proposed, status, decision_note,
            ${ms('decided_at')} as decided_at, ${ms('created_at')} as created_at, updated_at::text as ua
          from job_correction_requests where garage_id = ${garageId} and ${window('updated_at')} ${keyset('updated_at')} ${order('updated_at')}`;
        break;
      case 'cars':
        // Cars this garage has a job on, that changed in the window (the car or its plates), or that a
        // job in the window points at (a colleague's new job on an old car). Ordered by id only.
        query = sql`with garage_cars as (
              select distinct car_id from jobs where garage_id = ${garageId}),
            window_jobs as (
              select distinct car_id from jobs where garage_id = ${garageId} and ${window('updated_at')}),
            changed as (
              select c.id from cars c join garage_cars g on g.car_id = c.id
              where c.updated_at > ${since} and c.updated_at <= ${until}
              union select r.car_id from car_registrations r join garage_cars g on g.car_id = r.car_id
              where r.updated_at > ${since} and r.updated_at <= ${until}
              union select car_id from window_jobs)
          select c.id, r.reg_no, r.reg_year, c.chassis_no, c.make, c.model, c.year,
            c.merged_into_id is not null as deleted, null as ua
          from cars c join changed x on x.id = c.id
          left join car_registrations r on r.car_id = c.id and r.valid_to is null
          ${after ? sql`where c.id > ${after.i}::uuid` : sql``}
          order by c.id limit ${limit}`;
        break;
    }
    return (await tx.execute(query)).rows as Row[];
  }
}
