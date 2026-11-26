import type { WorkType } from './constants/work-types';

/**
 * When the next service is due after a job, if the mechanic didn't set a date (api/13). First
 * guesses to confirm with garage owners in the interviews (product doc).
 */
export const REMINDER_RULES: Partial<Record<WorkType, { days: number; km: number }>> = {
  oil_change: { days: 90, km: 5_000 },
  tuning: { days: 180, km: 10_000 },
};

/** A reminder counts as "came back" if the car returns this many days after it was due, at most. */
export const REMINDER_RETURN_WINDOW_DAYS = 30;

const addDays = (isoDay: string, days: number) =>
  new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The reminder a job creates, or null. The mechanic's "next service due" date wins; otherwise the
 * rule for the job's work. The kind is the work with a rule (oil change first), or the first work.
 */
export function reminderForJob(job: {
  serviceDate: string;
  nextServiceDueDate?: string | null;
  workTypes: readonly string[];
}): { kind: string; dueDate: string } | null {
  const ruled = (Object.keys(REMINDER_RULES) as WorkType[]).find((w) => job.workTypes.includes(w));
  if (job.nextServiceDueDate) {
    const kind = ruled ?? job.workTypes[0];
    return kind ? { kind, dueDate: job.nextServiceDueDate } : null;
  }
  if (!ruled) return null;
  return { kind: ruled, dueDate: addDays(job.serviceDate, REMINDER_RULES[ruled]!.days) };
}
