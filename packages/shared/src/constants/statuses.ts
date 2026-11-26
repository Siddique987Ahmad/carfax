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
