import { type Db, schema, withGarage, withSystem } from '@carfax/db';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, sql } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';

/** Staff per garage, including the owner (api/05). Stops abuse; easy to raise. */
export const STAFF_LIMIT = 10;

export interface GarageProfileInput {
  name: string;
  city: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** A garage's own profile, staff and numbers (api/05). Approval and suspension are admin/08. */
@Injectable()
export class GaragesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * A workshop owner creates their garage. It starts `pending` until ops approve it (admin/08).
   * One garage per owner for now, so nobody can flood the approval queue.
   */
  async create(userId: string, input: GarageProfileInput) {
    return withSystem(this.db, async (tx) => {
      const [owned] = await tx
        .select({ id: schema.garages.id })
        .from(schema.garages)
        .where(eq(schema.garages.ownerId, userId));
      if (owned) {
        throw new AppError('CONFLICT', 409, 'You already have a garage', { garageId: owned.id });
      }
      const [garage] = await tx
        .insert(schema.garages)
        .values({ ownerId: userId, ...input, status: 'pending' })
        .returning();
      await tx.insert(schema.garageMembers).values({ garageId: garage!.id, userId, role: 'owner' });
      await tx.insert(schema.auditLogs).values({
        actorId: userId,
        action: 'garage.create',
        entity: 'garage',
        entityId: garage!.id,
        after: { name: garage!.name, city: garage!.city, status: garage!.status },
      });
      return garage!;
    });
  }

  async get(garageId: string) {
    const [garage] = await this.db
      .select()
      .from(schema.garages)
      .where(eq(schema.garages.id, garageId));
    if (!garage) throw new AppError('NOT_FOUND', 404, 'Garage not found');
    return garage;
  }

  async update(garageId: string, input: Partial<GarageProfileInput>) {
    const [garage] = await this.db
      .update(schema.garages)
      .set(input)
      .where(eq(schema.garages.id, garageId))
      .returning();
    return garage!;
  }

  async members(garageId: string) {
    return withGarage(this.db, garageId, (tx) =>
      tx
        .select({
          userId: schema.users.id,
          name: schema.users.name,
          phone: schema.users.phone,
          role: schema.garageMembers.role,
          addedAt: schema.garageMembers.createdAt,
        })
        .from(schema.garageMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.garageMembers.userId))
        .orderBy(schema.garageMembers.createdAt),
    );
  }

  /**
   * Adds a mechanic by phone. A phone with no account gets one; the mechanic then signs in with a
   * login code. Someone already in the garage can't be added twice.
   */
  async addMechanic(garageId: string, actorId: string, phone: string, name?: string) {
    // Find or create the user outside the garage scope: users aren't garage-owned data.
    const userId = await withSystem(this.db, async (tx) => {
      const [existing] = await tx.select().from(schema.users).where(eq(schema.users.phone, phone));
      if (existing) return existing.id;
      const [created] = await tx
        .insert(schema.users)
        .values({ phone, name: name ?? null })
        .onConflictDoNothing({ target: schema.users.phone })
        .returning();
      return (
        created?.id ??
        (await tx.select().from(schema.users).where(eq(schema.users.phone, phone)))[0]!.id
      );
    });

    return withGarage(this.db, garageId, async (tx) => {
      // Lock the garage's staff rows so two additions at once can't both pass the limit.
      await tx.execute(sql`select 1 from garage_members where garage_id = ${garageId} for update`);
      const [{ value: staff }] = (await tx
        .select({ value: count() })
        .from(schema.garageMembers)) as [{ value: number }];
      const [already] = await tx
        .select()
        .from(schema.garageMembers)
        .where(eq(schema.garageMembers.userId, userId));
      if (already) throw new AppError('CONFLICT', 409, 'This person is already on your staff');
      if (staff >= STAFF_LIMIT) {
        throw new AppError('CONFLICT', 409, `A garage can have at most ${STAFF_LIMIT} staff`, {
          limit: STAFF_LIMIT,
        });
      }
      await tx.insert(schema.garageMembers).values({ garageId, userId, role: 'mechanic' });
      await tx.insert(schema.auditLogs).values({
        actorId,
        action: 'garage.member.add',
        entity: 'garage',
        entityId: garageId,
        after: { userId, role: 'mechanic' },
      });
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId));
      return { userId, name: user!.name, phone: user!.phone, role: 'mechanic' as const };
    });
  }

  /** Removes a mechanic. Takes effect on their very next request (api/04 checks membership live). */
  async removeMember(garageId: string, actorId: string, userId: string) {
    return withGarage(this.db, garageId, async (tx) => {
      const [member] = await tx
        .select()
        .from(schema.garageMembers)
        .where(eq(schema.garageMembers.userId, userId));
      if (!member) throw new AppError('NOT_FOUND', 404, 'Not on your staff');
      if (member.role === 'owner') {
        throw new AppError('CONFLICT', 409, "The owner can't be removed from their own garage");
      }
      await tx
        .delete(schema.garageMembers)
        .where(
          and(eq(schema.garageMembers.garageId, garageId), eq(schema.garageMembers.userId, userId)),
        );
      await tx.insert(schema.auditLogs).values({
        actorId,
        action: 'garage.member.remove',
        entity: 'garage',
        entityId: garageId,
        before: { userId, role: member.role },
      });
    });
  }

  /**
   * The owner's numbers: jobs this week and month, earnings this month, reminders sent this month.
   * Weeks start on Monday, in Pakistan time. Rejected jobs don't count.
   */
  async stats(garageId: string) {
    return withGarage(this.db, garageId, async (tx) => {
      const today = sql`(now() at time zone 'Asia/Karachi')::date`;
      const [jobs] = (
        await tx.execute(sql`
          select
            count(*) filter (where service_date >= date_trunc('week', ${today})::date)::int as "jobsThisWeek",
            count(*) filter (where service_date >= date_trunc('month', ${today})::date)::int as "jobsThisMonth",
            coalesce(sum(total_pkr) filter (where service_date >= date_trunc('month', ${today})::date), 0)::int
              as "earningsThisMonthPkr"
          from jobs
          where garage_id = ${garageId} and status <> 'rejected'`)
      ).rows as { jobsThisWeek: number; jobsThisMonth: number; earningsThisMonthPkr: number }[];
      const [reminders] = (
        await tx.execute(sql`
          select count(*)::int as "remindersSentThisMonth"
          from reminders
          where garage_id = ${garageId} and status = 'sent'
            and (sent_at at time zone 'Asia/Karachi')::date >= date_trunc('month', ${today})::date`)
      ).rows as { remindersSentThisMonth: number }[];
      return { ...jobs!, ...reminders! };
    });
  }
}
