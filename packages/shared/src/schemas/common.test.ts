import { describe, expect, it } from 'vitest';
import { canonicalCar } from '../constants/car-models';
import { can, canInGarage } from '../constants/permissions';
import { RegNoSchema, WorkTypeSchema } from './common';

describe('schemas', () => {
  it('RegNoSchema outputs the normalised plate', () => {
    expect(RegNoSchema.parse('lea-1234')).toBe('LEA1234');
  });

  it('RegNoSchema rejects text that is not a plate', () => {
    expect(RegNoSchema.safeParse('hello').success).toBe(false);
  });

  it('WorkTypeSchema accepts tuning and rejects unknown codes', () => {
    expect(WorkTypeSchema.parse('tuning')).toBe('tuning');
    expect(WorkTypeSchema.safeParse('car_wash').success).toBe(false);
  });
});

describe('can', () => {
  it('lets ops review jobs but not refund orders', () => {
    expect(can(['ops'], 'jobs.review')).toBe(true);
    expect(can(['ops'], 'orders.refund')).toBe(false);
  });

  it('uses any of a person’s roles', () => {
    expect(can(['buyer', 'admin'], 'audit.view')).toBe(true);
    expect(can(['buyer', 'dealer'], 'garages.view')).toBe(false);
  });
});

describe('canInGarage', () => {
  it('a mechanic logs jobs but sees no earnings and manages no staff', () => {
    expect(canInGarage('mechanic', 'jobs.create')).toBe(true);
    expect(canInGarage('mechanic', 'earnings.view')).toBe(false);
    expect(canInGarage('mechanic', 'staff.manage')).toBe(false);
    expect(canInGarage('owner', 'earnings.view')).toBe(true);
  });
});

describe('canonicalCar', () => {
  it('spells known makes and models one way', () => {
    expect(canonicalCar(' toyota ', 'COROLLA')).toEqual({ make: 'Toyota', model: 'Corolla' });
    expect(canonicalCar('suzuki', 'wagon  r')).toEqual({ make: 'Suzuki', model: 'Wagon R' });
  });

  it('keeps unknown ones as typed, trimmed', () => {
    expect(canonicalCar('Proton', ' Saga ')).toEqual({ make: 'Proton', model: 'Saga' });
    expect(canonicalCar('Honda', '')).toEqual({ make: 'Honda', model: null });
  });
});

describe('reminderForJob', () => {
  it("uses the mechanic's date when set, otherwise the rule for the work", async () => {
    const { reminderForJob } = await import('../reminders');
    expect(
      reminderForJob({
        serviceDate: '2026-11-20',
        nextServiceDueDate: '2027-01-15',
        workTypes: ['oil_change'],
      }),
    ).toEqual({ kind: 'oil_change', dueDate: '2027-01-15' });
    expect(
      reminderForJob({ serviceDate: '2026-11-20', workTypes: ['brakes', 'oil_change'] }),
    ).toEqual({ kind: 'oil_change', dueDate: '2027-02-18' });
    expect(reminderForJob({ serviceDate: '2026-11-20', workTypes: ['tuning'] })).toEqual({
      kind: 'tuning',
      dueDate: '2027-05-19',
    });
    expect(reminderForJob({ serviceDate: '2026-11-20', workTypes: ['brakes'] })).toBeNull();
    expect(
      reminderForJob({
        serviceDate: '2026-11-20',
        nextServiceDueDate: '2027-03-01',
        workTypes: ['brakes'],
      }),
    ).toEqual({ kind: 'brakes', dueDate: '2027-03-01' });
  });
});
