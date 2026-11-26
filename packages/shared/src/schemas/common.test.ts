import { describe, expect, it } from 'vitest';
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
