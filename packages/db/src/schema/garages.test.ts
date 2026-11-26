import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../testing/test-db';
import { customerInsertSchema, garageInsertSchema } from '../zod';
import { customers, garageMembers, garages } from './garages';
import { users } from './users';

let t: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  t = await createTestDatabase({ migrated: true });
});
afterAll(async () => {
  await t?.drop();
});

async function pgCode(query: Promise<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code;
  }
  return undefined;
}

let n = 2000000;
const phone = () => `+92301${n++}`;

async function makeGarage(name = 'Ahmed Motors') {
  const [owner] = await t.db.insert(users).values({ phone: phone() }).returning();
  const [garage] = await t.db
    .insert(garages)
    .values({ ownerId: owner!.id, name, city: 'Lahore' })
    .returning();
  return { owner: owner!, garage: garage! };
}

describe('garages', () => {
  it('a new garage is pending with trust score 100', async () => {
    const { garage } = await makeGarage();
    expect(garage.status).toBe('pending');
    expect(garage.trustScore).toBe(100);
  });

  it('a garage cannot exist without an owner', async () => {
    expect(
      await pgCode(t.db.execute(sql`insert into garages (name, city) values ('X', 'Lahore')`)),
    ).toBe('23502'); // not_null_violation
    expect(
      await pgCode(
        t.db.insert(garages).values({ ownerId: crypto.randomUUID(), name: 'X', city: 'Lahore' }),
      ),
    ).toBe('23503'); // foreign_key_violation
  });

  it('refuses a trust score outside 0–100 and impossible coordinates', async () => {
    const { garage } = await makeGarage();
    expect(
      await pgCode(t.db.update(garages).set({ trustScore: 101 }).where(eq(garages.id, garage.id))),
    ).toBe('23514');
    expect(
      await pgCode(t.db.update(garages).set({ lat: 95 }).where(eq(garages.id, garage.id))),
    ).toBe('23514');
  });

  it('owner and mechanic are members with their garage role', async () => {
    const { owner, garage } = await makeGarage();
    const [mechanic] = await t.db.insert(users).values({ phone: phone() }).returning();
    await t.db.insert(garageMembers).values([
      { garageId: garage.id, userId: owner.id, role: 'owner' },
      { garageId: garage.id, userId: mechanic!.id, role: 'mechanic' },
    ]);
    const members = await t.db
      .select()
      .from(garageMembers)
      .where(eq(garageMembers.garageId, garage.id));
    expect(members.map((m) => m.role).sort()).toEqual(['mechanic', 'owner']);
  });
});

describe('customers', () => {
  it('the same phone can be a customer at two garages, but not twice at one', async () => {
    const a = await makeGarage('A Motors');
    const b = await makeGarage('B Motors');
    const p = phone();
    await t.db.insert(customers).values({ garageId: a.garage.id, phone: p, name: 'Bilal' });
    await t.db.insert(customers).values({ garageId: b.garage.id, phone: p, name: 'Bilal' });
    expect(await pgCode(t.db.insert(customers).values({ garageId: a.garage.id, phone: p }))).toBe(
      '23505',
    );
  });

  it('a deleted customer does not block their phone from being added again', async () => {
    const { garage } = await makeGarage();
    const p = phone();
    await t.db.insert(customers).values({ garageId: garage.id, phone: p });
    await t.db
      .update(customers)
      .set({ deletedAt: new Date() })
      .where(and(eq(customers.garageId, garage.id), eq(customers.phone, p)));
    await t.db.insert(customers).values({ garageId: garage.id, phone: p });
  });

  it('accepts an id made on the phone (offline), and refuses a badly formatted phone', async () => {
    const { garage } = await makeGarage();
    const id = crypto.randomUUID();
    const [c] = await t.db.insert(customers).values({ id, garageId: garage.id }).returning();
    expect(c!.id).toBe(id);
    expect(
      await pgCode(t.db.insert(customers).values({ garageId: garage.id, phone: '0300-1234567' })),
    ).toBe('23514');
  });
});

describe('updated_at trigger', () => {
  it('updating a customer changes updated_at, even in raw SQL', async () => {
    const { garage } = await makeGarage();
    const [c] = await t.db
      .insert(customers)
      .values({ garageId: garage.id, updatedAt: new Date('2020-01-01T00:00:00Z') })
      .returning();
    await t.db.execute(sql`update customers set name = 'Sara' where id = ${c!.id}`);
    const [after] = await t.db.select().from(customers).where(eq(customers.id, c!.id));
    expect(after!.updatedAt.getTime()).toBeGreaterThan(new Date('2020-01-02').getTime());
  });

  it('every table with an updated_at column has the trigger', async () => {
    const result = await t.db.execute(sql`
      select c.table_name
      from information_schema.columns c
      where c.table_schema = 'public' and c.column_name = 'updated_at'
        and not exists (
          select 1 from pg_trigger tg
          join pg_class cl on cl.oid = tg.tgrelid
          join pg_proc p on p.oid = tg.tgfoid
          where cl.relname = c.table_name and p.proname = 'set_updated_at' and not tg.tgisinternal
        )
      order by 1`);
    expect(result.rows.map((r) => r.table_name)).toEqual([]);
  });
});

describe('Zod schemas from the garage tables', () => {
  it('garage insert needs a name and city, and valid coordinates', () => {
    const ownerId = crypto.randomUUID();
    expect(
      garageInsertSchema.safeParse({ ownerId, name: 'Ahmed Motors', city: 'Lahore' }).success,
    ).toBe(true);
    expect(garageInsertSchema.safeParse({ ownerId, name: ' ', city: 'Lahore' }).success).toBe(
      false,
    );
    expect(
      garageInsertSchema.safeParse({ ownerId, name: 'Ahmed Motors', city: 'Lahore', lat: 95 })
        .success,
    ).toBe(false);
  });

  it('customer insert allows no phone, but not a wrongly formatted one', () => {
    const garageId = crypto.randomUUID();
    expect(customerInsertSchema.safeParse({ garageId }).success).toBe(true);
    expect(customerInsertSchema.safeParse({ garageId, phone: '0300-1234567' }).success).toBe(false);
  });
});
