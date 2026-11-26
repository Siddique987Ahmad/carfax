// Short, readable test data (api/02). Inserted as the table owner, so row-level security doesn't
// get in the way of setting up; the API itself still connects as carfax_app.
import { schema } from '@carfax/db';
import type { createTestDatabase } from '@carfax/db/testing';
import type { PlatformRole } from '@carfax/shared';

type Db = Awaited<ReturnType<typeof createTestDatabase>>['db'];

let counter = Math.floor(Math.random() * 9_000_000);
/** A unique, valid Pakistani mobile number. */
export const nextPhone = () =>
  `+92345${String(1_000_000 + (counter++ % 9_000_000)).padStart(7, '0')}`;
/** A unique, valid plate. */
export const nextPlate = () => `TST${String(counter++).slice(-6)}`;

export async function createUser(db: Db, opts: { roles?: PlatformRole[]; name?: string } = {}) {
  const [user] = await db
    .insert(schema.users)
    .values({ phone: nextPhone(), name: opts.name ?? 'Test User' })
    .returning();
  if (opts.roles?.length) {
    await db
      .insert(schema.userRoles)
      .values(opts.roles.map((role) => ({ userId: user!.id, role })));
  }
  return user!;
}

export async function createGarage(
  db: Db,
  opts: { status?: 'pending' | 'active' | 'suspended'; name?: string } = {},
) {
  const owner = await createUser(db, { name: 'Garage Owner' });
  const [garage] = await db
    .insert(schema.garages)
    .values({
      ownerId: owner.id,
      name: opts.name ?? 'Test Motors',
      city: 'Lahore',
      status: opts.status ?? 'active',
    })
    .returning();
  await db
    .insert(schema.garageMembers)
    .values({ garageId: garage!.id, userId: owner.id, role: 'owner' });
  return { garage: garage!, owner };
}

export async function createCar(
  db: Db,
  opts: { plate?: string; make?: string; model?: string } = {},
) {
  return db.transaction(async (tx) => {
    const [car] = await tx
      .insert(schema.cars)
      .values({ make: opts.make ?? 'Toyota', model: opts.model ?? 'Corolla', year: 2018 })
      .returning();
    const [registration] = await tx
      .insert(schema.carRegistrations)
      .values({ carId: car!.id, regNo: opts.plate ?? nextPlate() })
      .returning();
    return { car: car!, regNo: registration!.regNo };
  });
}

export async function createCustomer(
  db: Db,
  garageId: string,
  opts: { name?: string; phone?: string } = {},
) {
  const [customer] = await db
    .insert(schema.customers)
    .values({ garageId, name: opts.name ?? 'Test Customer', phone: opts.phone ?? nextPhone() })
    .returning();
  return customer!;
}

export async function createJob(
  db: Db,
  opts: {
    garageId: string;
    carId: string;
    createdBy: string;
    customerId?: string;
    odometerKm?: number;
    regNo?: string;
  },
) {
  const [job] = await db
    .insert(schema.jobs)
    .values({
      garageId: opts.garageId,
      carId: opts.carId,
      createdBy: opts.createdBy,
      customerId: opts.customerId ?? null,
      regNo: opts.regNo ?? null,
      serviceDate: '2026-11-20',
      odometerKm: opts.odometerKm ?? 50_000,
      deviceCreatedAt: new Date(),
      status: 'approved',
    })
    .returning();
  return job!;
}
