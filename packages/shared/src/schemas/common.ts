import { z } from 'zod';
import { FLAG_CODES, GARAGE_STATUSES, JOB_STATUSES } from '../constants/statuses';
import { WORK_TYPES } from '../constants/work-types';
import { normaliseChassisNo, normalisePakistanMobile, normaliseRegNo } from '../utils/identifiers';

export const WorkTypeSchema = z.enum(WORK_TYPES);
export const JobStatusSchema = z.enum(JOB_STATUSES);
export const GarageStatusSchema = z.enum(GARAGE_STATUSES);
export const FlagCodeSchema = z.enum(FLAG_CODES);

/** Accepts any plate spelling and outputs the normalised form. */
export const RegNoSchema = z.string().transform((value, ctx) => {
  const normalised = normaliseRegNo(value);
  if (!normalised) {
    ctx.addIssue({ code: 'custom', message: 'Not a valid registration number' });
    return z.NEVER;
  }
  return normalised;
});

/** Accepts any chassis spelling and outputs the normalised form. */
export const ChassisNoSchema = z.string().transform((value, ctx) => {
  const normalised = normaliseChassisNo(value);
  if (!normalised) {
    ctx.addIssue({ code: 'custom', message: 'Not a valid chassis number' });
    return z.NEVER;
  }
  return normalised;
});

/** Accepts any spelling of a Pakistani mobile number and outputs '+923XXXXXXXXX'. */
export const PakistanMobileSchema = z.string().transform((value, ctx) => {
  const normalised = normalisePakistanMobile(value);
  if (!normalised) {
    ctx.addIssue({ code: 'custom', message: 'Not a Pakistani mobile number' });
    return z.NEVER;
  }
  return normalised;
});
