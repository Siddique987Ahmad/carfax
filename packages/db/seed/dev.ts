import type { Db } from '../src/client';
import { auditLogs } from '../src/schema/audit';
import { carAliases, carRegistrations, cars } from '../src/schema/cars';
import { customers, garageMembers, garages } from '../src/schema/garages';
import { jobFlags, jobItems, jobPhotos, jobs, reminders } from '../src/schema/jobs';
import { userRoles, users } from '../src/schema/users';
import {
  BODY_WORK_NOTES,
  CAR_MODELS,
  type CarModel,
  DEV_GARAGES,
  FIRST_NAMES,
  LAST_NAMES,
  WORK,
} from './data';
import { addDays, createRng, isoDate, type Rng } from './rng';

type Row<T extends { $inferInsert: unknown }> = T['$inferInsert'];

/** Everything a seed inserts, in foreign-key order. */
export interface SeedRows {
  users: Row<typeof users>[];
  userRoles: Row<typeof userRoles>[];
  garages: Row<typeof garages>[];
  garageMembers: Row<typeof garageMembers>[];
  customers: Row<typeof customers>[];
  cars: Row<typeof cars>[];
  carRegistrations: Row<typeof carRegistrations>[];
  carAliases: Row<typeof carAliases>[];
  jobs: Row<typeof jobs>[];
  jobItems: Row<typeof jobItems>[];
  jobPhotos: Row<typeof jobPhotos>[];
  jobFlags: Row<typeof jobFlags>[];
  reminders: Row<typeof reminders>[];
  auditLogs: Row<typeof auditLogs>[];
}

export const emptyRows = (): SeedRows => ({
  users: [],
  userRoles: [],
  garages: [],
  garageMembers: [],
  customers: [],
  cars: [],
  carRegistrations: [],
  carAliases: [],
  jobs: [],
  jobItems: [],
  jobPhotos: [],
  jobFlags: [],
  reminders: [],
  auditLogs: [],
});

/** Inserts all rows as the table owner, in one transaction, in batches. */
export async function insertRows(db: Db, rows: SeedRows): Promise<void> {
  await db.transaction(async (tx) => {
    const batches = async <T>(table: Parameters<typeof tx.insert>[0], values: T[]) => {
      for (let i = 0; i < values.length; i += 500) {
        await tx.insert(table).values(values.slice(i, i + 500) as never);
      }
    };
    await batches(users, rows.users);
    await batches(userRoles, rows.userRoles);
    await batches(garages, rows.garages);
    await batches(garageMembers, rows.garageMembers);
    await batches(customers, rows.customers);
    await batches(cars, rows.cars);
    await batches(carRegistrations, rows.carRegistrations);
    await batches(carAliases, rows.carAliases);
    await batches(jobs, rows.jobs);
    await batches(jobItems, rows.jobItems);
    await batches(jobPhotos, rows.jobPhotos);
    await batches(jobFlags, rows.jobFlags);
    await batches(reminders, rows.reminders);
    await batches(auditLogs, rows.auditLogs);
  });
}

/** Team accounts. Log in with these phones; the code prints to the terminal locally. */
export const TEAM = [
  { phone: '+923000000001', name: 'Super Admin', role: 'admin' },
  { phone: '+923000000002', name: 'Ops Team', role: 'ops' },
  { phone: '+923000000003', name: 'Support Team', role: 'support' },
] as const;

export function addTeam(rng: Rng, rows: SeedRows): string[] {
  return TEAM.map(({ phone, name, role }) => {
    const id = rng.uuid();
    rows.users.push({ id, phone, name });
    rows.userRoles.push({ userId: id, role });
    return id;
  });
}

const personName = (rng: Rng) => `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;

/** A Lahore-style plate ('LEA1234') or another city's ('ABC123'), normalised. */
function makePlate(rng: Rng, city: string, used: Set<string>): string {
  for (;;) {
    const plate =
      city === 'Lahore'
        ? `LE${rng.letters(1)}${rng.digits(rng.chance(0.8) ? 4 : 3)}`
        : `${rng.letters(3)}${rng.digits(rng.chance(0.7) ? 3 : 4)}`;
    if (!used.has(plate)) {
      used.add(plate);
      return plate;
    }
  }
}

function makeChassis(rng: Rng, model: CarModel, used: Set<string>): string {
  for (;;) {
    const chassis = model.framePrefix
      ? `${model.framePrefix}${rng.digits(7)}`
      : `MR${rng.letters(1, 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789')}${rng.letters(14, 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789')}`;
    if (!used.has(chassis)) {
      used.add(chassis);
      return chassis;
    }
  }
}

export interface DevSummary {
  garages: number;
  cars: number;
  jobs: number;
  flaggedJobs: number;
  pendingGarages: number;
  duplicatePairs: number;
}

/**
 * The `dev` seed (db/08): 8 garages in Lahore and Islamabad, about 300 cars and 2,000 jobs over
 * 18 months, with the edge cases every screen must handle: rollbacks, missing photos, misread
 * odometers, too many visits in a week, broken odometers, duplicate cars, a plate that moved to
 * another car, and pending and suspended garages.
 */
export function buildDevSeed(
  today: Date,
  seed = 20261127,
): { rows: SeedRows; summary: DevSummary } {
  const rng = createRng(seed);
  const rows = emptyRows();
  const [, opsId] = addTeam(rng, rows);
  const usedPhones = new Set<string>(TEAM.map((t) => t.phone));
  const phone = () => {
    for (;;) {
      const p = `+923${rng.pick(['00', '01', '21', '33', '45'])}${rng.digits(7)}`;
      if (!usedPhones.has(p)) {
        usedPhones.add(p);
        return p;
      }
    }
  };

  // Garages, owners and mechanics.
  const garageInfo = DEV_GARAGES.map((g) => {
    const ownerId = rng.uuid();
    const id = rng.uuid();
    rows.users.push({ id: ownerId, phone: phone(), name: personName(rng) });
    rows.garages.push({
      id,
      ownerId,
      name: g.name,
      city: g.city,
      address: g.address,
      lat: g.lat,
      lng: g.lng,
      status: g.status,
      statusReason: g.status === 'suspended' ? 'Many jobs without odometer photos' : null,
      statusChangedAt: g.status === 'pending' ? null : addDays(today, -540),
      trustScore: g.status === 'suspended' ? 42 : rng.int(85, 100),
    });
    rows.garageMembers.push({ garageId: id, userId: ownerId, role: 'owner' });
    const staff = [ownerId];
    for (let i = rng.int(1, 3); i > 0; i--) {
      const mechanicId = rng.uuid();
      rows.users.push({ id: mechanicId, phone: phone(), name: personName(rng) });
      rows.garageMembers.push({ garageId: id, userId: mechanicId, role: 'mechanic' });
      staff.push(mechanicId);
    }
    if (g.status !== 'pending') {
      rows.auditLogs.push({
        actorId: opsId,
        action: 'garage.approve',
        entity: 'garage',
        entityId: id,
        note: 'Visited the workshop; owner agreed to log every job',
        after: { status: 'active' },
        createdAt: addDays(today, -540),
      });
    }
    if (g.status === 'suspended') {
      rows.auditLogs.push({
        actorId: opsId,
        action: 'garage.suspend',
        entity: 'garage',
        entityId: id,
        note: 'Many jobs without odometer photos; spot-check found no camera use',
        before: { status: 'active' },
        after: { status: 'suspended' },
        createdAt: addDays(today, -20),
      });
    }
    return { ...g, id, staff, customers: new Map<string, string>() };
  });
  const working = garageInfo.filter((g) => g.status !== 'pending');

  // Car owners (they appear as customers at the garages they visit).
  const people = Array.from({ length: 260 }, () => ({ name: personName(rng), phone: phone() }));
  const customerAt = (garage: (typeof garageInfo)[number], person: (typeof people)[number]) => {
    let id = garage.customers.get(person.phone);
    if (!id) {
      id = rng.uuid();
      garage.customers.set(person.phone, id);
      rows.customers.push({ id, garageId: garage.id, name: person.name, phone: person.phone });
    }
    return id;
  };

  // Cars and their visits.
  const usedPlates = new Set<string>();
  const usedChassis = new Set<string>();
  const start = addDays(today, -540); // 18 months
  type JobRef = {
    id: string;
    carId: string;
    garage: (typeof garageInfo)[number];
    date: Date;
    km: number;
  };
  const jobsByCar = new Map<string, JobRef[]>();

  const addJob = (job: {
    carId: string;
    garage: (typeof garageInfo)[number];
    customerId: string;
    regNo: string | null;
    date: Date;
    km: number | null;
    work?: (typeof WORK)[number];
    photo?: boolean;
    ocrKm?: number | null;
  }) => {
    const id = rng.uuid();
    const work = job.work ?? rng.weighted(WORK.map((w) => [w, w.weight] as const));
    const items = [work];
    if (rng.chance(0.3)) items.push(rng.weighted(WORK.map((w) => [w, w.weight] as const)));
    let total = 0;
    for (const w of items) {
      const part = w.part ? rng.int(w.part[1], w.part[2]) : null;
      const labour = rng.int(w.labour[0], w.labour[1]);
      total += (part ?? 0) + labour;
      rows.jobItems.push({
        id: rng.uuid(),
        jobId: id,
        workType: w.type,
        description: w.type === 'denting_painting' ? rng.pick(BODY_WORK_NOTES) : null,
        partName: w.part?.[0] ?? null,
        partPricePkr: part,
        labourPricePkr: labour,
      });
    }
    const loggedAt = new Date(job.date.getTime() + rng.int(9, 19) * 3_600_000);
    const isOil = items.some((w) => w.type === 'oil_change');
    rows.jobs.push({
      id,
      carId: job.carId,
      garageId: job.garage.id,
      customerId: job.customerId,
      createdBy: rng.pick(job.garage.staff),
      regNo: job.regNo,
      serviceDate: isoDate(job.date),
      odometerKm: job.km,
      odometerNotWorking: job.km === null,
      totalPkr: total,
      status: job.date > addDays(today, -3) ? 'submitted' : 'approved',
      nextServiceDueDate: isOil ? isoDate(addDays(job.date, 90)) : null,
      nextServiceDueKm: isOil && job.km !== null ? job.km + 5000 : null,
      deviceCreatedAt: loggedAt,
      syncedAt: new Date(loggedAt.getTime() + rng.int(1, 240) * 60_000),
    });
    if (job.photo !== false && job.km !== null) {
      rows.jobPhotos.push({
        id: rng.uuid(),
        jobId: id,
        kind: 'odometer',
        storageKey: `seed/jobs/${id}/odometer.jpg`,
        uploadedAt: loggedAt,
        takenAt: loggedAt,
        ocrReading: job.ocrKm === undefined ? job.km : job.ocrKm,
        lat: Number((job.garage.lat + (rng.next() - 0.5) * 0.002).toFixed(6)),
        lng: Number((job.garage.lng + (rng.next() - 0.5) * 0.002).toFixed(6)),
        gpsAccuracyM: rng.int(5, 30),
      });
    }
    if (items.some((w) => w.type === 'denting_painting')) {
      for (const kind of ['before', 'after'] as const) {
        rows.jobPhotos.push({
          id: rng.uuid(),
          jobId: id,
          kind,
          storageKey: `seed/jobs/${id}/${kind}.jpg`,
          uploadedAt: loggedAt,
          takenAt: loggedAt,
        });
      }
    }
    const ref = { id, carId: job.carId, garage: job.garage, date: job.date, km: job.km ?? 0 };
    jobsByCar.set(job.carId, [...(jobsByCar.get(job.carId) ?? []), ref]);
    return ref;
  };

  const carInfo: {
    id: string;
    plate: string | null;
    model: CarModel;
    year: number;
    owner: (typeof people)[number];
    home: (typeof garageInfo)[number];
  }[] = [];
  for (let i = 0; i < 300; i++) {
    const model = rng.weighted(CAR_MODELS.map((m) => [m, m.weight] as const));
    const home = rng.weighted(working.map((g) => [g, g.city === 'Lahore' ? 3 : 2] as const));
    const owner = rng.pick(people);
    const id = rng.uuid();
    const knowChassis = model.framePrefix ? rng.chance(0.9) : rng.chance(0.4);
    const plate =
      model.framePrefix && rng.chance(0.03) ? null : makePlate(rng, home.city, usedPlates);
    const year = rng.int(model.years[0], model.years[1]);
    rows.cars.push({
      id,
      chassisNo: knowChassis || !plate ? makeChassis(rng, model, usedChassis) : null,
      make: model.make,
      model: model.model,
      year,
    });
    if (plate)
      rows.carRegistrations.push({
        id: rng.uuid(),
        carId: id,
        regNo: plate,
        regYear: Math.max(year, 2008),
        validFrom: start,
      });
    carInfo.push({ id, plate, model, year, owner, home });

    // Visits every 1 to 3.5 months, with mileage rising at this car's own pace.
    let km = rng.int(5_000, 140_000);
    const perDay = rng.int(model.kmPerDay[0], model.kmPerDay[1]);
    let date = addDays(start, rng.int(0, 150));
    for (let v = rng.int(4, 12); v > 0 && date < today; v--) {
      const garage = rng.chance(0.85)
        ? home
        : rng.pick(working.filter((g) => g.city === home.city));
      addJob({ carId: id, garage, customerId: customerAt(garage, owner), regNo: plate, date, km });
      const gap = rng.int(35, 100);
      date = addDays(date, gap);
      km += gap * perDay + rng.int(-300, 300);
    }
  }

  // Edge cases. Each sets the job to `flagged` with the flag the automatic checks would raise.
  const flag = (jobId: string, code: string, details: Record<string, unknown>) => {
    const job = rows.jobs.find((j) => j.id === jobId)!;
    job.status = 'flagged';
    rows.jobFlags.push({ id: rng.uuid(), jobId, code, details });
  };
  const carsWith = (min: number) =>
    carInfo.filter((c) => (jobsByCar.get(c.id)?.length ?? 0) >= min);
  const takeCars = (min: number, count: number, taken: Set<string>) => {
    const out: typeof carInfo = [];
    for (const car of carsWith(min)) {
      if (out.length === count) break;
      if (!taken.has(car.id) && rng.chance(0.5)) {
        taken.add(car.id);
        out.push(car);
      }
    }
    return out;
  };
  const taken = new Set<string>();

  // Rollbacks: from one visit on, the odometer reads 20–40% lower.
  for (const car of takeCars(3, 30, taken)) {
    const visits = jobsByCar.get(car.id)!;
    const at = rng.int(1, visits.length - 1);
    const previousKm = visits[at - 1]!.km;
    const drop = Math.round(visits[at]!.km * (0.2 + rng.next() * 0.2));
    for (const v of visits.slice(at)) {
      const row = rows.jobs.find((j) => j.id === v.id)!;
      row.odometerKm = v.km - drop;
      const photo = rows.jobPhotos.find((p) => p.jobId === v.id && p.kind === 'odometer');
      if (photo) photo.ocrReading = v.km - drop;
    }
    flag(visits[at]!.id, 'MILEAGE_DROP', { previousKm, thisKm: visits[at]!.km - drop });
  }

  // Jobs with no odometer photo.
  for (const car of takeCars(2, 30, taken)) {
    const visit = rng.pick(jobsByCar.get(car.id)!);
    rows.jobPhotos = rows.jobPhotos.filter((p) => !(p.jobId === visit.id && p.kind === 'odometer'));
    flag(visit.id, 'NO_PHOTO', { graceHours: 24 });
  }

  // Misread odometers: the photo says something else than what was typed.
  for (const car of takeCars(2, 30, taken)) {
    const visit = rng.pick(jobsByCar.get(car.id)!);
    const photo = rows.jobPhotos.find((p) => p.jobId === visit.id && p.kind === 'odometer');
    if (!photo) continue;
    const read = Math.round(visit.km * (rng.chance(0.5) ? 1.1 : 0.9));
    photo.ocrReading = read;
    flag(visit.id, 'OCR_MISMATCH', { typedKm: visit.km, photoKm: read });
  }

  // Too many visits in one week.
  for (const car of takeCars(2, 8, taken)) {
    const last = jobsByCar.get(car.id)!.at(-1)!;
    let extra = last;
    for (let i = 1; i <= 3; i++) {
      extra = addJob({
        carId: car.id,
        garage: last.garage,
        customerId: customerAt(last.garage, car.owner),
        regNo: car.plate,
        date: addDays(last.date, i * 2),
        km: last.km + i * 40,
      });
    }
    flag(extra.id, 'MANY_JOBS_SHORT_TIME', { jobsInSevenDays: 4 });
  }

  // Broken odometers: kept out of mileage checks, not flagged.
  for (const car of takeCars(2, 10, taken)) {
    const visit = rng.pick(jobsByCar.get(car.id)!);
    const row = rows.jobs.find((j) => j.id === visit.id)!;
    row.odometerKm = null;
    row.odometerNotWorking = true;
    row.nextServiceDueKm = null;
    rows.jobPhotos = rows.jobPhotos.filter((p) => !(p.jobId === visit.id && p.kind === 'odometer'));
  }

  // The suspended garage's recent jobs are mostly missing photos.
  const suspended = garageInfo.find((g) => g.status === 'suspended')!;
  for (const job of rows.jobs
    .filter((j) => j.garageId === suspended.id && j.status === 'approved')
    .slice(-12)) {
    rows.jobPhotos = rows.jobPhotos.filter((p) => !(p.jobId === job.id && p.kind === 'odometer'));
    flag(job.id!, 'NO_PHOTO', { graceHours: 24 });
  }

  // Duplicate cars for the merge screen (admin/13): the same car added twice with a plate typo.
  let duplicatePairs = 0;
  for (const car of takeCars(2, 12, taken)) {
    if (duplicatePairs === 5) break;
    if (!car.plate) continue;
    const typo = `${car.plate.slice(0, -2)}${car.plate.at(-1)}${car.plate.at(-2)}`;
    if (typo === car.plate || usedPlates.has(typo)) continue;
    usedPlates.add(typo);
    const id = rng.uuid();
    rows.cars.push({ id, make: car.model.make, model: car.model.model, year: car.year });
    rows.carRegistrations.push({
      id: rng.uuid(),
      carId: id,
      regNo: typo,
      validFrom: addDays(today, -60),
    });
    const other = rng.pick(working.filter((g) => g.city === car.home.city && g.id !== car.home.id));
    const lastKm = jobsByCar.get(car.id)!.at(-1)!.km;
    addJob({
      carId: id,
      garage: other,
      customerId: customerAt(other, car.owner),
      regNo: typo,
      date: addDays(today, -40),
      km: lastKm + 2000,
    });
    duplicatePairs++;
  }

  // Two phones created the same car offline: the second phone's id is an alias (api/06).
  for (const car of carInfo.slice(0, 3))
    rows.carAliases.push({ aliasId: rng.uuid(), carId: car.id });

  // A plate that moved to another car (Punjab, since Sept 2025): the owner kept the plate.
  const mover = carInfo.find(
    (c) => c.plate?.startsWith('LE') && !taken.has(c.id) && (jobsByCar.get(c.id)?.length ?? 0) >= 2,
  );
  if (mover?.plate) {
    taken.add(mover.id);
    const movedOn = addDays(today, -90);
    const oldReg = rows.carRegistrations.find((r) => r.carId === mover.id)!;
    oldReg.validTo = movedOn;
    oldReg.endedReason = 'plate_moved';
    const newPlate = makePlate(rng, 'Lahore', usedPlates);
    rows.carRegistrations.push({
      id: rng.uuid(),
      carId: mover.id,
      regNo: newPlate,
      validFrom: movedOn,
    });
    const newCarId = rng.uuid();
    rows.cars.push({
      id: newCarId,
      make: 'Honda',
      model: 'Civic',
      year: 2025,
      chassisNo: makeChassis(
        rng,
        CAR_MODELS.find((m) => m.model === 'Civic')!,
        usedChassis,
      ),
    });
    rows.carRegistrations.push({
      id: rng.uuid(),
      carId: newCarId,
      regNo: mover.plate,
      validFrom: movedOn,
    });
    addJob({
      carId: newCarId,
      garage: mover.home,
      customerId: customerAt(mover.home, mover.owner),
      regNo: mover.plate,
      date: addDays(today, -30),
      km: 1200,
      work: WORK[0],
    });
    // Jobs on the old car after the move carry its new plate.
    for (const v of jobsByCar.get(mover.id)!.filter((v) => v.date >= movedOn)) {
      rows.jobs.find((j) => j.id === v.id)!.regNo = newPlate;
    }
  }

  // Reminders from oil changes; marked as returned when the car came back within 30 days of due.
  for (const job of rows.jobs) {
    if (!job.nextServiceDueDate || job.status === 'flagged') continue;
    const due = new Date(`${job.nextServiceDueDate}T00:00:00Z`);
    const past = due < today;
    const sentAt = addDays(due, -2);
    // Only a visit after the reminder went out, and at most 30 days after the due date, counts as
    // coming back because of it (the dashboard's reminder success rate, admin/16).
    const returned = past
      ? (jobsByCar.get(job.carId) ?? []).find(
          (v) => v.garage.id === job.garageId && v.date >= sentAt && v.date <= addDays(due, 30),
        )
      : undefined;
    rows.reminders.push({
      id: rng.uuid(),
      garageId: job.garageId,
      carId: job.carId,
      customerId: job.customerId,
      sourceJobId: job.id,
      kind: 'oil_change',
      dueDate: job.nextServiceDueDate,
      status: past ? 'sent' : 'scheduled',
      sentAt: past ? sentAt : null,
      returnedJobId: returned?.id ?? null,
    });
  }

  return {
    rows,
    summary: {
      garages: rows.garages.length,
      cars: rows.cars.length,
      jobs: rows.jobs.length,
      flaggedJobs: rows.jobs.filter((j) => j.status === 'flagged').length,
      pendingGarages: rows.garages.filter((g) => g.status === 'pending').length,
      duplicatePairs,
    },
  };
}

export async function seedDev(db: Db, today = new Date()): Promise<DevSummary> {
  const { rows, summary } = buildDevSeed(today);
  await insertRows(db, rows);
  return summary;
}
