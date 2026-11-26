import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../testing/test-db';
import { publicUserSchema, userInsertSchema } from '../zod';
import { adminRecoveryCodes, userRoles, users } from './users';

let t: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  t = await createTestDatabase({ migrated: true });
});
afterAll(async () => {
  await t?.drop();
});

/** The Postgres error code a query fails with (Drizzle wraps the driver error). */
async function pgCode(query: Promise<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code;
  }
  return undefined;
}

let phoneCounter = 1000000;
const nextPhone = () => `+92300${phoneCounter++}`;

describe('users and roles', () => {
  it('one user can hold buyer and car_owner at the same time', async () => {
    const [user] = await t.db.insert(users).values({ phone: nextPhone() }).returning();
    await t.db.insert(userRoles).values([
      { userId: user!.id, role: 'buyer' },
      { userId: user!.id, role: 'car_owner' },
    ]);
    const roles = await t.db.select().from(userRoles).where(eq(userRoles.userId, user!.id));
    expect(roles.map((r) => r.role).sort()).toEqual(['buyer', 'car_owner']);
  });

  it('the same role twice is refused', async () => {
    const [user] = await t.db.insert(users).values({ phone: nextPhone() }).returning();
    await t.db.insert(userRoles).values({ userId: user!.id, role: 'dealer' });
    expect(await pgCode(t.db.insert(userRoles).values({ userId: user!.id, role: 'dealer' }))).toBe(
      '23505', // unique_violation
    );
  });

  it.each([['03001234567'], ['+92 300 1234567'], ['+9242357612'], ['+447700900123']])(
    'the database refuses a badly formatted phone: %s',
    async (phone) => {
      // check_violation, or string_data_right_truncation when it's longer than the column
      expect(['23514', '22001']).toContain(await pgCode(t.db.insert(users).values({ phone })));
    },
  );

  it('the same phone can only belong to one user', async () => {
    const phone = nextPhone();
    await t.db.insert(users).values({ phone });
    expect(await pgCode(t.db.insert(users).values({ phone }))).toBe('23505');
  });

  it('the second factor cannot be switched on without a secret', async () => {
    expect(
      await pgCode(t.db.insert(users).values({ phone: nextPhone(), totpEnabledAt: new Date() })),
    ).toBe('23514');
  });

  it('new users are active, and updatedAt moves on update', async () => {
    const [user] = await t.db.insert(users).values({ phone: nextPhone() }).returning();
    expect(user!.isActive).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    const [updated] = await t.db
      .update(users)
      .set({ name: 'Ahmed' })
      .where(eq(users.id, user!.id))
      .returning();
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(user!.updatedAt.getTime());
  });

  it('deleting a user removes their roles and recovery codes', async () => {
    const [user] = await t.db.insert(users).values({ phone: nextPhone() }).returning();
    await t.db.insert(userRoles).values({ userId: user!.id, role: 'support' });
    await t.db.insert(adminRecoveryCodes).values({ userId: user!.id, codeHash: 'hash' });
    await t.db.delete(users).where(eq(users.id, user!.id));
    expect(await t.db.select().from(userRoles).where(eq(userRoles.userId, user!.id))).toEqual([]);
    expect(
      await t.db.select().from(adminRecoveryCodes).where(eq(adminRecoveryCodes.userId, user!.id)),
    ).toEqual([]);
  });
});

describe('Zod schemas from the users table', () => {
  it('insert schema accepts the stored phone format and rejects others', () => {
    expect(userInsertSchema.safeParse({ phone: '+923001234567' }).success).toBe(true);
    expect(userInsertSchema.safeParse({ phone: '03001234567' }).success).toBe(false);
  });

  it('the public schema never includes the TOTP secret', () => {
    expect(Object.keys(publicUserSchema.shape)).not.toContain('totpSecretEnc');
  });
});
