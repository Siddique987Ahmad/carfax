/**
 * Work a garage can record on a job card. Fixed codes, so reports, flags and reminders can rely on them.
 * Labels live in @carfax/i18n (workTypes.<code>). Tuning was added to the product doc's list (Nov 26, 2026).
 */
export const WORK_TYPES = [
  'oil_change',
  'tuning',
  'brakes',
  'denting_painting',
  'engine',
  'suspension',
  'ac',
  'electrical',
  'other',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

/** Work types that count as body work in reports (accident and body-work flags). */
export const BODY_WORK_TYPES = ['denting_painting'] as const satisfies readonly WorkType[];
