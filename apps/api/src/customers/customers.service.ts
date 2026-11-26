import { type Db, schema, withGarage } from '@carfax/db';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { GarageContext } from '../access/access.decorators';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';

export const CUSTOMER_SEARCH_MAX = 100;

/** Treats %, _ and \ typed by a user as plain characters in a LIKE pattern. */
const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The digits to look for in stored phones ('+923001234567'), from however the user typed part of a
 * number: '0300 123' → '300123', '+92 300' → '300'. Null if there are too few digits to be a phone.
 */
function phoneDigits(q: string): string | null {
  let digits = q.replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92') && digits.length > 4) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 3 ? digits : null;
}

/**
 * A garage's private customer list (api/11). Customers are created and edited through sync
 * (api/08); these add search, history and deletion. Only the caller's garage (row-level security).
 */
@Injectable()
export class CustomersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** By part of the name or phone; most recent visit first. Deleted customers never appear. */
  async search(garage: GarageContext, q: string | undefined, limit: number) {
    const text = q?.trim();
    const digits = text ? phoneDigits(text) : null;
    const match = text
      ? sql`and (c.name ilike ${`%${likeEscape(text)}%`} escape '\\'${digits ? sql` or c.phone like ${`%${digits}%`}` : sql``})`
      : sql``;
    const rows = await withGarage(this.db, garage.garageId, (tx) =>
      tx.execute(sql`
        select c.id, c.name, c.phone,
          (select max(j.service_date)::text from jobs j where j.customer_id = c.id) as "lastVisit",
          (select count(*)::int from jobs j where j.customer_id = c.id) as visits,
          coalesce((
            select json_agg(json_build_object('id', car.id, 'regNo', r.reg_no, 'make', car.make, 'model', car.model) order by car.id)
            from (select distinct car_id from jobs where customer_id = c.id) jc
            join cars car on car.id = jc.car_id
            left join car_registrations r on r.car_id = car.id and r.valid_to is null
          ), '[]'::json) as cars
        from customers c
        where c.garage_id = ${garage.garageId} and c.deleted_at is null ${match}
        order by "lastVisit" desc nulls last, c.name, c.id
        limit ${limit}`),
    );
    return rows.rows;
  }

  /** One customer with their visits and reminders. Prices follow api/09's rule. */
  async detail(garage: GarageContext, userId: string, customerId: string) {
    return withGarage(this.db, garage.garageId, async (tx) => {
      const [customer] = await tx
        .select()
        .from(schema.customers)
        .where(and(eq(schema.customers.id, customerId), isNull(schema.customers.deletedAt)));
      if (!customer) throw new AppError('NOT_FOUND', 404, 'Customer not found');
      const visits = (
        await tx.execute(sql`
          select j.id, j.service_date::text as "serviceDate", j.car_id as "carId", j.reg_no as "regNo",
            car.make, car.model, j.status,
            case when ${garage.role === 'owner'} or j.created_by = ${userId}::uuid then j.total_pkr end as "totalPkr",
            coalesce((select array_agg(distinct i.work_type order by i.work_type) from job_items i
              where i.job_id = j.id and i.deleted_at is null), '{}') as "workTypes"
          from jobs j join cars car on car.id = j.car_id
          where j.customer_id = ${customerId}
          order by j.service_date desc, j.id desc`)
      ).rows;
      const reminders = await tx
        .select({
          id: schema.reminders.id,
          kind: schema.reminders.kind,
          dueDate: schema.reminders.dueDate,
          status: schema.reminders.status,
          carId: schema.reminders.carId,
        })
        .from(schema.reminders)
        .where(and(eq(schema.reminders.customerId, customerId), isNull(schema.reminders.deletedAt)))
        .orderBy(schema.reminders.dueDate);
      return { id: customer.id, name: customer.name, phone: customer.phone, visits, reminders };
    });
  }

  /**
   * A privacy request: clears the name and phone, cancels open reminders (there's no number to send
   * them to), and keeps the jobs, so the car's history survives without the person. The audit entry
   * records that it happened, never the deleted details.
   */
  async delete(garage: GarageContext, actorId: string, customerId: string) {
    await withGarage(this.db, garage.garageId, async (tx) => {
      const [customer] = await tx
        .update(schema.customers)
        .set({ name: null, phone: null, deletedAt: new Date() })
        .where(and(eq(schema.customers.id, customerId), isNull(schema.customers.deletedAt)))
        .returning({ id: schema.customers.id });
      if (!customer) throw new AppError('NOT_FOUND', 404, 'Customer not found');
      await tx
        .update(schema.reminders)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(schema.reminders.customerId, customerId),
            eq(schema.reminders.status, 'scheduled'),
          ),
        );
      await tx.insert(schema.auditLogs).values({
        actorId,
        action: 'customer.delete',
        entity: 'customer',
        entityId: customerId,
        note: 'Name and phone cleared on request; jobs kept',
      });
    });
  }
}
