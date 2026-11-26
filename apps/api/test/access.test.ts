import { type Db, schema, withGarage } from '@carfax/db';
import { Controller, Get, Inject, Module, Patch, Post } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AdminPermission,
  CurrentGarage,
  type GarageContext,
  GaragePermission,
  Public,
  SignedIn,
} from '../src/access/access.decorators';
import { routesWithoutAccessRule } from '../src/access/route-coverage';
import { DB } from '../src/db/db.module';
import { createCar, createGarage, createJob, createUser } from './factories';
import { startTestApp, type TestApp } from './harness';

// Test-only routes, one per kind of access rule.
@Controller('test-access')
class AccessRoutes {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Lists jobs WITHOUT a garage filter: only row-level security keeps other garages out. */
  @Get('jobs')
  @GaragePermission('jobs.view')
  jobs(@CurrentGarage() garage: GarageContext) {
    return withGarage(this.db, garage.garageId, (tx) =>
      tx.select({ garageId: schema.jobs.garageId }).from(schema.jobs),
    );
  }

  @Post('jobs')
  @GaragePermission('jobs.create')
  createJob(@CurrentGarage() garage: GarageContext) {
    return { created: true, garageId: garage.garageId };
  }

  @Get('earnings')
  @GaragePermission('earnings.view')
  earnings() {
    return { totalPkr: 125_000 };
  }

  @Patch('profile')
  @GaragePermission('garage.edit')
  editProfile() {
    return { saved: true };
  }

  @Get('audit')
  @AdminPermission('audit.view')
  audit() {
    return { ok: true };
  }

  @Get('signed-in')
  @SignedIn()
  signedIn() {
    return { ok: true };
  }

  @Get('public')
  @Public()
  open() {
    return { ok: true };
  }

  /** Forgot its access rule: must be refused. */
  @Get('forgotten')
  forgotten() {
    return { secret: 'should never be returned' };
  }
}

@Module({ controllers: [AccessRoutes] })
class AccessRoutesModule {}

let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let B: Awaited<ReturnType<typeof createGarage>>;
let mechanicPhone: string;

beforeAll(async () => {
  t = await startTestApp({ imports: [AccessRoutesModule] });
  A = await createGarage(t.db, { name: 'A Motors' });
  B = await createGarage(t.db, { name: 'B Motors' });
  const mechanic = await createUser(t.db);
  mechanicPhone = mechanic.phone;
  await t.db
    .insert(schema.garageMembers)
    .values({ garageId: A.garage.id, userId: mechanic.id, role: 'mechanic' });
  for (const g of [A, B]) {
    const { car } = await createCar(t.db);
    await createJob(t.db, { garageId: g.garage.id, carId: car.id, createdBy: g.owner.id });
  }
});
afterAll(async () => {
  await t?.close();
});

describe('garage roles', () => {
  it('a mechanic calling an owner-only route gets 403', async () => {
    const mechanic = await t.asUser(mechanicPhone);
    const res = await mechanic.http.get('/v1/test-access/earnings').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('the owner can call it', async () => {
    const owner = await t.asUser(A.owner.phone);
    await owner.http.get('/v1/test-access/earnings').expect(200);
  });

  it('a mechanic can log jobs', async () => {
    const mechanic = await t.asUser(mechanicPhone);
    const res = await mechanic.http.post('/v1/test-access/jobs').expect(201);
    expect(res.body.garageId).toBe(A.garage.id);
  });

  it('a removed mechanic loses access at once, though their token is still valid', async () => {
    const extra = await createUser(t.db);
    await t.db
      .insert(schema.garageMembers)
      .values({ garageId: A.garage.id, userId: extra.id, role: 'mechanic' });
    const session = await t.asUser(extra.phone);
    await session.http.get('/v1/test-access/jobs').expect(200);
    await t.db.delete(schema.garageMembers).where(eq(schema.garageMembers.userId, extra.id));
    await session.http.get('/v1/test-access/jobs').expect(403);
  });

  it('a disabled account is refused on garage routes at once', async () => {
    const extra = await createUser(t.db);
    await t.db
      .insert(schema.garageMembers)
      .values({ garageId: A.garage.id, userId: extra.id, role: 'mechanic' });
    const session = await t.asUser(extra.phone);
    await t.db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, extra.id));
    await session.http.get('/v1/test-access/jobs').expect(403);
  });
});

describe('garage separation', () => {
  it('garage A sees only its own jobs, even through a query with no garage filter', async () => {
    const owner = await t.asUser(A.owner.phone);
    const res = await owner.http.get('/v1/test-access/jobs').expect(200);
    expect(res.body).toEqual([{ garageId: A.garage.id }]);
  });

  it("asking for garage B with A's login is refused", async () => {
    const owner = await t.asUser(A.owner.phone);
    await owner.http.get('/v1/test-access/jobs').set('x-garage-id', B.garage.id).expect(403);
  });

  it('someone in two garages must say which one', async () => {
    const both = await createUser(t.db);
    await t.db.insert(schema.garageMembers).values([
      { garageId: A.garage.id, userId: both.id, role: 'mechanic' },
      { garageId: B.garage.id, userId: both.id, role: 'owner' },
    ]);
    const session = await t.asUser(both.phone);
    const res = await session.http.get('/v1/test-access/jobs').expect(400);
    expect(res.body.error.code).toBe('GARAGE_REQUIRED');
    const inB = await session.http
      .get('/v1/test-access/jobs')
      .set('x-garage-id', B.garage.id)
      .expect(200);
    expect(inB.body).toEqual([{ garageId: B.garage.id }]);
    // Owner in B, mechanic in A: the role is per garage.
    await session.http.get('/v1/test-access/earnings').set('x-garage-id', B.garage.id).expect(200);
    await session.http.get('/v1/test-access/earnings').set('x-garage-id', A.garage.id).expect(403);
  });

  it('refuses an X-Garage-Id that is not an id', async () => {
    const owner = await t.asUser(A.owner.phone);
    await owner.http.get('/v1/test-access/jobs').set('x-garage-id', "x' or 1=1").expect(400);
  });

  it('a user in no garage is refused', async () => {
    const buyer = await t.asUser((await createUser(t.db)).phone);
    await buyer.http.get('/v1/test-access/jobs').expect(403);
  });
});

describe('garage status', () => {
  it('a suspended garage can read but not write', async () => {
    const S = await createGarage(t.db, { status: 'suspended' });
    const owner = await t.asUser(S.owner.phone);
    await owner.http.get('/v1/test-access/jobs').expect(200);
    const res = await owner.http.post('/v1/test-access/jobs').expect(403);
    expect(res.body.error.code).toBe('GARAGE_SUSPENDED');
    await owner.http.patch('/v1/test-access/profile').expect(403);
  });

  it('a pending garage can finish its setup but not log jobs', async () => {
    const P = await createGarage(t.db, { status: 'pending' });
    const owner = await t.asUser(P.owner.phone);
    await owner.http.patch('/v1/test-access/profile').expect(200);
    const res = await owner.http.post('/v1/test-access/jobs').expect(403);
    expect(res.body.error.code).toBe('GARAGE_PENDING');
  });
});

describe('other rules', () => {
  it('not signed in: 401 on any non-public route, 200 on a public one', async () => {
    await t.http.get('/v1/test-access/jobs').expect(401);
    await t.http.get('/v1/test-access/signed-in').expect(401);
    await t.http.get('/v1/test-access/audit').expect(401);
    await t.http.get('/v1/test-access/public').expect(200);
  });

  it('admin routes follow the team roles, read fresh', async () => {
    const admin = await t.asUser((await createUser(t.db, { roles: ['admin'] })).phone);
    const ops = await t.asUser((await createUser(t.db, { roles: ['ops'] })).phone);
    const buyer = await t.asUser((await createUser(t.db, { roles: ['buyer'] })).phone);
    await admin.http.get('/v1/test-access/audit').expect(200);
    await ops.http.get('/v1/test-access/audit').expect(403);
    await buyer.http.get('/v1/test-access/audit').expect(403);
    // Roles removed: refused at once, not after the token expires.
    await t.db.delete(schema.userRoles).where(eq(schema.userRoles.userId, admin.userId));
    await admin.http.get('/v1/test-access/audit').expect(403);
  });

  it('a route with no access rule is refused, and says so in the log', async () => {
    const res = await t.http.get('/v1/test-access/forgotten').expect(403);
    expect(JSON.stringify(res.body)).not.toContain('should never be returned');
    expect(t.logs.join('\n')).toContain('route has no access rule');
  });
});

describe('route coverage', () => {
  it('every route of the real API has an access rule', async () => {
    const real = await startTestApp();
    try {
      expect(routesWithoutAccessRule(real.app)).toEqual([]);
    } finally {
      await real.close();
    }
  });

  it('the check finds a route without one', () => {
    expect(routesWithoutAccessRule(t.app)).toEqual(['AccessRoutes.forgotten (forgotten)']);
  });
});
