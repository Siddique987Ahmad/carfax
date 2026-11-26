import type { Db } from '../src/client';
import { addTeam, emptyRows, insertRows, type SeedRows } from './dev';
import { addDays, createRng, isoDate } from './rng';

/** The three car stories the demo is built around, by plate. */
export const DEMO_PLATES = { clean: 'LEA1234', rollback: 'LEB5678', accident: 'LEC9012' } as const;

/**
 * The `demo` seed (db/08): a small, polished set for showing garage owners and dealers.
 * Three Lahore garages and three cars, each telling one story:
 * - LEA-1234 Toyota Corolla 2018: a clean, regular service history at one garage.
 * - LEB-5678 Honda Civic 2017: 92,400 km in May, then 61,300 km at another garage: a rollback.
 * - LEC-9012 Honda City 2019: accident repairs (bumper, bonnet, fender) with before/after photos.
 */
export function buildDemoSeed(today: Date): SeedRows {
  const rng = createRng(4242);
  const rows = emptyRows();
  const [, opsId] = addTeam(rng, rows);
  const daysAgo = (n: number) => addDays(today, -n);

  const garage = (
    name: string,
    address: string,
    lat: number,
    lng: number,
    ownerPhone: string,
    ownerName: string,
  ) => {
    const id = rng.uuid();
    const ownerId = rng.uuid();
    rows.users.push({ id: ownerId, phone: ownerPhone, name: ownerName });
    rows.garages.push({
      id,
      ownerId,
      name,
      city: 'Lahore',
      address,
      lat,
      lng,
      status: 'active',
      statusChangedAt: daysAgo(700),
      trustScore: 98,
    });
    rows.garageMembers.push({ garageId: id, userId: ownerId, role: 'owner' });
    return { id, ownerId, lat, lng };
  };
  const ahmed = garage(
    'Ahmed Motors',
    'Nicholson Road',
    31.5609,
    74.3378,
    '+923001110001',
    'Ahmed Butt',
  );
  const bilal = garage(
    'Bilal Autos',
    'Montgomery Road',
    31.5546,
    74.3285,
    '+923001110002',
    'Bilal Chaudhry',
  );
  const punjab = garage(
    'Punjab Car Care',
    'Johar Town, Block G',
    31.4697,
    74.2728,
    '+923001110003',
    'Usman Malik',
  );

  const car = (
    plate: string,
    make: string,
    model: string,
    year: number,
    chassisNo: string | null,
  ) => {
    const id = rng.uuid();
    rows.cars.push({ id, make, model, year, chassisNo });
    rows.carRegistrations.push({
      id: rng.uuid(),
      carId: id,
      regNo: plate,
      regYear: year,
      validFrom: daysAgo(800),
    });
    return id;
  };
  const customer = (g: { id: string }, name: string, phone: string) => {
    const id = rng.uuid();
    rows.customers.push({ id, garageId: g.id, name, phone });
    return id;
  };

  type Item = {
    workType: string;
    description?: string;
    partName?: string;
    part?: number;
    labour: number;
  };
  const job = (
    g: ReturnType<typeof garage>,
    carId: string,
    customerId: string,
    plate: string,
    days: number,
    km: number,
    items: Item[],
    extra: { beforeAfter?: boolean } = {},
  ) => {
    const id = rng.uuid();
    const at = new Date(daysAgo(days).getTime() + 11 * 3_600_000);
    const isOil = items.some((i) => i.workType === 'oil_change');
    rows.jobs.push({
      id,
      carId,
      garageId: g.id,
      customerId,
      createdBy: g.ownerId,
      regNo: plate,
      serviceDate: isoDate(daysAgo(days)),
      odometerKm: km,
      totalPkr: items.reduce((sum, i) => sum + (i.part ?? 0) + i.labour, 0),
      status: 'approved',
      nextServiceDueDate: isOil ? isoDate(addDays(daysAgo(days), 90)) : null,
      nextServiceDueKm: isOil ? km + 5000 : null,
      deviceCreatedAt: at,
      syncedAt: new Date(at.getTime() + 600_000),
    });
    for (const i of items) {
      rows.jobItems.push({
        id: rng.uuid(),
        jobId: id,
        workType: i.workType,
        description: i.description ?? null,
        partName: i.partName ?? null,
        partPricePkr: i.part ?? null,
        labourPricePkr: i.labour,
      });
    }
    const photo = (kind: 'odometer' | 'before' | 'after') =>
      rows.jobPhotos.push({
        id: rng.uuid(),
        jobId: id,
        kind,
        storageKey: `seed/demo/${id}/${kind}.jpg`,
        uploadedAt: at,
        takenAt: at,
        ocrReading: kind === 'odometer' ? km : null,
        lat: g.lat,
        lng: g.lng,
        gpsAccuracyM: 8,
      });
    photo('odometer');
    if (extra.beforeAfter) {
      photo('before');
      photo('after');
    }
    return id;
  };
  const oil = (part = 7800): Item[] => [
    { workType: 'oil_change', partName: 'Engine oil + filter', part, labour: 700 },
  ];

  // 1. A clean history: oil change every three to four months at the same garage.
  const corolla = car(DEMO_PLATES.clean, 'Toyota', 'Corolla', 2018, 'MR0BR9FE403012345');
  const hamza = customer(ahmed, 'Hamza Qureshi', '+923214440001');
  const visits: [number, number, Item[]][] = [
    [720, 18_250, oil()],
    [610, 24_100, oil()],
    [
      500,
      30_400,
      [...oil(), { workType: 'tuning', partName: 'Spark plugs', part: 2600, labour: 2000 }],
    ],
    [390, 36_900, oil(8200)],
    [
      280,
      43_150,
      [
        ...oil(8200),
        { workType: 'brakes', partName: 'Front brake pads', part: 6500, labour: 1200 },
      ],
    ],
    [170, 49_800, oil(8500)],
    [60, 56_300, oil(8500)],
  ];
  for (const [days, km, items] of visits)
    job(ahmed, corolla, hamza, DEMO_PLATES.clean, days, km, items);

  // 2. A rollback: steady rise to 92,400 km, then 61,300 km at another garage.
  const civic = car(DEMO_PLATES.rollback, 'Honda', 'Civic', 2017, null);
  const faisalA = customer(ahmed, 'Faisal Raza', '+923214440002');
  const faisalB = customer(bilal, 'Faisal Raza', '+923214440002');
  job(ahmed, civic, faisalA, DEMO_PLATES.rollback, 640, 71_200, oil());
  job(ahmed, civic, faisalA, DEMO_PLATES.rollback, 520, 78_900, oil());
  job(ahmed, civic, faisalA, DEMO_PLATES.rollback, 400, 85_600, [
    ...oil(),
    { workType: 'suspension', partName: 'Front shocks', part: 18_000, labour: 3000 },
  ]);
  job(ahmed, civic, faisalA, DEMO_PLATES.rollback, 200, 92_400, oil());
  const rollbackJob = job(bilal, civic, faisalB, DEMO_PLATES.rollback, 45, 61_300, oil());
  rows.jobFlags.push({
    id: rng.uuid(),
    jobId: rollbackJob,
    code: 'MILEAGE_DROP',
    details: { previousKm: 92_400, thisKm: 61_300 },
    resolvedBy: opsId,
    resolvedAt: daysAgo(44),
  });
  rows.auditLogs.push({
    actorId: opsId,
    action: 'job.approve',
    entity: 'job',
    entityId: rollbackJob,
    note: 'Photo checked: the odometer really shows 61,300 km, 31,100 km below the last visit. Kept and shown as a possible rollback.',
    createdAt: daysAgo(44),
  });

  // 3. Accident repairs: bumper, bonnet and fender, with before and after photos.
  const city = car(DEMO_PLATES.accident, 'Honda', 'City', 2019, 'MRHGM6640KP012345');
  const sara = customer(punjab, 'Sara Malik', '+923214440003');
  job(punjab, city, sara, DEMO_PLATES.accident, 480, 33_500, oil());
  job(
    punjab,
    city,
    sara,
    DEMO_PLATES.accident,
    300,
    41_200,
    [
      {
        workType: 'denting_painting',
        description: 'Front bumper repaint',
        partName: 'Paint and filler',
        part: 9000,
        labour: 8000,
      },
      {
        workType: 'denting_painting',
        description: 'Bonnet dent removed and repainted',
        partName: 'Paint and filler',
        part: 7000,
        labour: 9000,
      },
      {
        workType: 'denting_painting',
        description: 'Right front fender replaced',
        partName: 'Fender panel',
        part: 22_000,
        labour: 6000,
      },
    ],
    { beforeAfter: true },
  );
  job(punjab, city, sara, DEMO_PLATES.accident, 150, 47_900, oil());

  // Reminders: the Corolla's next oil change is due soon.
  rows.reminders.push({
    id: rng.uuid(),
    garageId: ahmed.id,
    carId: corolla,
    customerId: hamza,
    kind: 'oil_change',
    dueDate: isoDate(addDays(today, 30)),
  });
  return rows;
}

export async function seedDemo(db: Db, today = new Date()): Promise<void> {
  await insertRows(db, buildDemoSeed(today));
}
