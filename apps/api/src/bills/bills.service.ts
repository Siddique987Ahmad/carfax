import { createHash, randomBytes } from 'node:crypto';
import { type Db, schema, withGarage, withSystem } from '@carfax/db';
import { type Locale, t } from '@carfax/i18n';
import type { WorkType } from '@carfax/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { GarageContext } from '../access/access.decorators';
import { getConfig } from '../config';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';

/** At most this many sends per job per day, so a customer isn't spammed (api/12). */
export const BILL_SENDS_PER_DAY = 3;
/** Bill links keep working for a year; customers look bills up months later. */
export const BILL_LINK_DAYS = 365;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const rupees = (n: number) => n.toLocaleString('en-PK');

interface BillData {
  garage: { name: string; city: string; address: string | null };
  car: { make: string | null; model: string | null; year: number | null; regNo: string | null };
  serviceDate: string;
  odometerKm: number | null;
  items: {
    workType: string;
    description: string | null;
    partName: string | null;
    partPricePkr: number | null;
    labourPricePkr: number | null;
  }[];
  totalPkr: number;
  nextServiceDueDate: string | null;
}

/**
 * Bills (api/12). In the pilot, a bill is sent with one tap from the garage's own WhatsApp: the API
 * returns a wa.me link with the bill text and a link to the bill page. Bill pages need no login and
 * show only that one job: the garage, the car, the work, the prices; never the customer's name or
 * phone, and no other visits.
 */
@Injectable()
export class BillsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async send(garage: GarageContext, userId: string, jobId: string, locale: Locale) {
    return withGarage(this.db, garage.garageId, async (tx) => {
      const [job] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
      if (!job) throw new AppError('NOT_FOUND', 404, 'Job not found');
      const [customer] = job.customerId
        ? await tx
            .select({ phone: schema.customers.phone })
            .from(schema.customers)
            .where(and(eq(schema.customers.id, job.customerId), isNull(schema.customers.deletedAt)))
        : [];
      if (!customer?.phone) {
        throw new AppError(
          'NO_CUSTOMER_PHONE',
          400,
          "Add the customer's phone number to send the bill on WhatsApp",
        );
      }
      // Lock the job's sends so two taps at once can't both pass the daily limit.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`bill:${jobId}`}))`);
      const [{ sendsToday }] = (
        await tx.execute(sql`select count(*)::int as "sendsToday" from bill_sends
          where job_id = ${jobId} and created_at > now() - interval '1 day'`)
      ).rows as [{ sendsToday: number }];
      if (sendsToday >= BILL_SENDS_PER_DAY) {
        throw new AppError(
          'RATE_LIMITED',
          429,
          `A bill can be sent at most ${BILL_SENDS_PER_DAY} times a day`,
          {
            limit: BILL_SENDS_PER_DAY,
          },
        );
      }

      const token = randomBytes(24).toString('base64url');
      await tx.insert(schema.billSends).values({
        jobId,
        garageId: garage.garageId,
        sentBy: userId,
        method: 'wa_me',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + BILL_LINK_DAYS * 86_400_000),
      });
      const billUrl = `${getConfig().PUBLIC_WEB_URL}/b/${token}`;
      const text = this.billText(await this.load(tx, jobId), billUrl, locale);
      const number = customer.phone.replace('+', ''); // wa.me wants 923001234567
      return {
        method: 'wa_me' as const,
        shareLink: `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
        billUrl,
        text,
        sendsToday: sendsToday + 1,
      };
    });
  }

  /** The public bill page's data. Unknown or expired links are 404. */
  async byToken(token: string): Promise<BillData & { notice: string }> {
    return withSystem(this.db, async (tx) => {
      const [send] = await tx
        .select({ jobId: schema.billSends.jobId })
        .from(schema.billSends)
        .where(
          and(
            eq(schema.billSends.tokenHash, sha256(token)),
            gt(schema.billSends.expiresAt, new Date()),
          ),
        );
      if (!send) throw new AppError('NOT_FOUND', 404, 'Bill not found');
      return { ...(await this.load(tx, send.jobId)), notice: t('en', 'bill.notice') };
    });
  }

  private async load(
    tx: Parameters<Parameters<Db['transaction']>[0]>[0],
    jobId: string,
  ): Promise<BillData> {
    const [row] = (
      await tx.execute(sql`
        select j.service_date::text as "serviceDate", j.odometer_km as "odometerKm", j.total_pkr as "totalPkr",
          j.next_service_due_date::text as "nextServiceDueDate", j.reg_no as "regNo",
          g.name as "garageName", g.city, g.address, c.make, c.model, c.year
        from jobs j join garages g on g.id = j.garage_id join cars c on c.id = j.car_id
        where j.id = ${jobId}`)
    ).rows as {
      serviceDate: string;
      odometerKm: number | null;
      totalPkr: number | null;
      nextServiceDueDate: string | null;
      regNo: string | null;
      garageName: string;
      city: string;
      address: string | null;
      make: string | null;
      model: string | null;
      year: number | null;
    }[];
    const items = await tx
      .select({
        workType: schema.jobItems.workType,
        description: schema.jobItems.description,
        partName: schema.jobItems.partName,
        partPricePkr: schema.jobItems.partPricePkr,
        labourPricePkr: schema.jobItems.labourPricePkr,
      })
      .from(schema.jobItems)
      .where(and(eq(schema.jobItems.jobId, jobId), isNull(schema.jobItems.deletedAt)))
      .orderBy(schema.jobItems.createdAt);
    const r = row!;
    return {
      garage: { name: r.garageName, city: r.city, address: r.address },
      car: { make: r.make, model: r.model, year: r.year, regNo: r.regNo },
      serviceDate: r.serviceDate,
      odometerKm: r.odometerKm,
      items,
      totalPkr:
        r.totalPkr ??
        items.reduce((s, i) => s + (i.partPricePkr ?? 0) + (i.labourPricePkr ?? 0), 0),
      nextServiceDueDate: r.nextServiceDueDate,
    };
  }

  /** The WhatsApp message, in English or Urdu. */
  billText(bill: BillData, billUrl: string, locale: Locale): string {
    const car = [bill.car.make, bill.car.model].filter(Boolean).join(' ') || '—';
    const amount = (n: number) => t(locale, 'bill.amount', { amount: rupees(n) });
    const lines = bill.items.map((item) => {
      const label = [
        t(locale, `workTypes.${item.workType as WorkType}`),
        item.description ?? item.partName,
      ]
        .filter(Boolean)
        .join(': ');
      const price = (item.partPricePkr ?? 0) + (item.labourPricePkr ?? 0);
      return price > 0 ? `• ${label} — ${amount(price)}` : `• ${label}`;
    });
    return [
      `*${bill.garage.name}*`,
      t(locale, 'bill.forCar', { car, plate: bill.car.regNo ?? '—' }),
      t(locale, 'bill.date', { date: bill.serviceDate }),
      ...(bill.odometerKm != null
        ? [t(locale, 'bill.odometer', { km: rupees(bill.odometerKm) })]
        : []),
      '',
      ...lines,
      '',
      `*${t(locale, 'bill.total', { amount: amount(bill.totalPkr) })}*`,
      ...(bill.nextServiceDueDate
        ? [t(locale, 'bill.nextService', { date: bill.nextServiceDueDate })]
        : []),
      '',
      t(locale, 'bill.viewBill', { link: billUrl }),
      '',
      `_${t(locale, 'bill.notice')}_`,
    ].join('\n');
  }
}
