import { type Db, schema, type Tx, withGarage } from '@carfax/db';
import { type Locale, t } from '@carfax/i18n';
import { REMINDER_RETURN_WINDOW_DAYS, reminderForJob, type WorkType } from '@carfax/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { GarageContext } from '../access/access.decorators';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';

export interface NewJobForReminders {
  id: string;
  carId: string;
  customerId: string | null;
  serviceDate: string;
  nextServiceDueDate: string | null;
  workTypes: string[];
}

/**
 * Service reminders (api/13). Created from jobs during sync push; sent with one tap from the
 * garage's own WhatsApp in the pilot. A reminder that was sent counts as "came back" when the car
 * returns to the garage between sending and 30 days after the due date (admin/16's metric).
 */
@Injectable()
export class RemindersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Inside the sync push transaction (api/08), for jobs new in this push, oldest first:
   * 1. a sent reminder for this car at this garage is marked returned, if the visit is in its window;
   * 2. a reminder not sent yet for the same work is cancelled (the customer came anyway);
   * 3. the job's own reminder is created.
   */
  async applyNewJobs(tx: Tx, garageId: string, jobs: NewJobForReminders[]) {
    for (const job of [...jobs].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))) {
      await tx.execute(sql`
        update reminders set returned_job_id = ${job.id}
        where garage_id = ${garageId} and car_id = ${job.carId} and status = 'sent'
          and returned_job_id is null and deleted_at is null
          and ${job.serviceDate}::date >= (sent_at at time zone 'Asia/Karachi')::date
          and ${job.serviceDate}::date <= due_date + ${REMINDER_RETURN_WINDOW_DAYS}::int`);
      if (job.workTypes.length) {
        await tx.execute(sql`
          update reminders set status = 'cancelled'
          where garage_id = ${garageId} and car_id = ${job.carId} and status = 'scheduled'
            and deleted_at is null and kind in ${job.workTypes}`);
      }
      const reminder = reminderForJob(job);
      if (reminder && job.customerId) {
        await tx.insert(schema.reminders).values({
          garageId,
          carId: job.carId,
          customerId: job.customerId,
          sourceJobId: job.id,
          kind: reminder.kind,
          dueDate: reminder.dueDate,
        });
      }
    }
  }

  /** Reminders not sent yet and due within `withinDays` (overdue ones included), soonest first. */
  async due(garage: GarageContext, withinDays: number) {
    return withGarage(
      this.db,
      garage.garageId,
      async (tx) =>
        (
          await tx.execute(sql`
          select r.id, r.kind, r.due_date::text as "dueDate", r.car_id as "carId", r.source_job_id as "sourceJobId",
            c.id as "customerId", c.name as "customerName", c.phone as "customerPhone",
            reg.reg_no as "regNo", car.make, car.model,
            (select max(j.service_date)::text from jobs j where j.car_id = r.car_id and j.garage_id = r.garage_id) as "lastVisit"
          from reminders r
          join cars car on car.id = r.car_id
          left join customers c on c.id = r.customer_id and c.deleted_at is null
          left join car_registrations reg on reg.car_id = r.car_id and reg.valid_to is null
          where r.garage_id = ${garage.garageId} and r.status = 'scheduled' and r.deleted_at is null
            and r.due_date <= (now() at time zone 'Asia/Karachi')::date + ${withinDays}::int
          order by r.due_date, r.id`)
        ).rows,
    );
  }

  /** One tap: a wa.me link with the reminder typed in. Marks it sent. */
  async send(garage: GarageContext, reminderId: string, locale: Locale) {
    return withGarage(this.db, garage.garageId, async (tx) => {
      const [row] = (
        await tx.execute(sql`
          select r.status, r.kind, r.due_date::text as "dueDate", c.name, c.phone, g.name as garage,
            reg.reg_no as "regNo", car.make, car.model
          from reminders r
          join garages g on g.id = r.garage_id
          join cars car on car.id = r.car_id
          left join customers c on c.id = r.customer_id and c.deleted_at is null
          left join car_registrations reg on reg.car_id = r.car_id and reg.valid_to is null
          where r.id = ${reminderId} and r.deleted_at is null
          for update of r`)
      ).rows as {
        status: string;
        kind: string;
        dueDate: string;
        name: string | null;
        phone: string | null;
        garage: string;
        regNo: string | null;
        make: string | null;
        model: string | null;
      }[];
      if (!row) throw new AppError('NOT_FOUND', 404, 'Reminder not found');
      if (row.status !== 'scheduled')
        throw new AppError('CONFLICT', 409, `This reminder is already ${row.status}`);
      if (!row.phone)
        throw new AppError(
          'NO_CUSTOMER_PHONE',
          400,
          "Add the customer's phone number to send the reminder",
        );

      const params = {
        car: [row.make, row.model].filter(Boolean).join(' ') || '—',
        plate: row.regNo ?? '—',
        work: t(locale, `workTypes.${row.kind as WorkType}`),
        date: row.dueDate,
        garage: row.garage,
      };
      const text = row.name
        ? t(locale, 'reminder.textNamed', { ...params, name: row.name })
        : t(locale, 'reminder.text', params);
      await tx
        .update(schema.reminders)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(schema.reminders.id, reminderId));
      return {
        method: 'wa_me' as const,
        shareLink: `https://wa.me/${row.phone.replace('+', '')}?text=${encodeURIComponent(text)}`,
        text,
      };
    });
  }

  /** Snooze (move the due date) or cancel a reminder that hasn't been sent. */
  async update(
    garage: GarageContext,
    reminderId: string,
    change: { action: 'snooze'; days: number } | { action: 'cancel' },
  ) {
    return withGarage(this.db, garage.garageId, async (tx) => {
      const [reminder] = await tx
        .select()
        .from(schema.reminders)
        .where(and(eq(schema.reminders.id, reminderId), isNull(schema.reminders.deletedAt)));
      if (!reminder) throw new AppError('NOT_FOUND', 404, 'Reminder not found');
      if (reminder.status !== 'scheduled')
        throw new AppError('CONFLICT', 409, `This reminder is already ${reminder.status}`);
      const [updated] = await tx
        .update(schema.reminders)
        .set(
          change.action === 'snooze'
            ? {
                dueDate: sql`greatest(${schema.reminders.dueDate}, (now() at time zone 'Asia/Karachi')::date) + ${change.days}::int`,
              }
            : { status: 'cancelled' },
        )
        .where(eq(schema.reminders.id, reminderId))
        .returning({
          id: schema.reminders.id,
          status: schema.reminders.status,
          dueDate: schema.reminders.dueDate,
        });
      return updated!;
    });
  }
}
