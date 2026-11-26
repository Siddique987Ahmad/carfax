/** Life of a job: logged on the phone, synced, then approved or flagged by the checks, or rejected by ops. */
export const JOB_STATUSES = ['draft', 'submitted', 'approved', 'flagged', 'rejected'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** A workshop must be approved by ops before its jobs are accepted. */
export const GARAGE_STATUSES = ['pending', 'active', 'suspended'] as const;
export type GarageStatus = (typeof GARAGE_STATUSES)[number];

/** Automatic checks on a job (workers/02). A flagged job stays out of reports until reviewed. */
export const FLAG_CODES = [
  'MILEAGE_DROP',
  'NO_PHOTO',
  'OCR_MISMATCH',
  'MANY_JOBS_SHORT_TIME',
  'FAR_FROM_GARAGE',
] as const;
export type FlagCode = (typeof FLAG_CODES)[number];

/** Each flag in plain words, for garages and ops (api/10). The apps may translate by code. */
export const FLAG_DESCRIPTIONS: Readonly<Record<FlagCode, string>> = {
  MILEAGE_DROP: 'The odometer reading is lower than an earlier visit',
  NO_PHOTO: 'No odometer photo was received',
  OCR_MISMATCH: 'The reading in the photo differs from the typed reading',
  MANY_JOBS_SHORT_TIME: 'Many visits for this car within a few days',
  FAR_FROM_GARAGE: 'The photo was taken far from the garage',
};
