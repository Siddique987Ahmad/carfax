/** Background job queues (BullMQ), shared by the API (which adds jobs) and the workers (which run them). */
export const QUEUES = {
  /** Checks a newly synced job: mileage drop, missing photo, misread odometer… (workers/02). */
  flagChecks: 'flag-checks',
} as const;
