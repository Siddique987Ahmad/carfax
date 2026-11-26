import { z } from 'zod';

/**
 * Stable error codes in every API error response: `{ error: { code, message, details?, requestId } }`.
 * The apps translate these codes into Urdu and English; `message` is for developers and logs.
 * Never change a code's meaning once the apps use it; add a new one instead.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  /** Wrong code; details.attemptsLeft says how many tries remain (api/03). */
  'OTP_INVALID',
  /** No valid code: expired, already used, or never requested. Ask for a new one. */
  'OTP_EXPIRED',
  /** Too many wrong tries; the code is gone. Ask for a new one. */
  'OTP_LOCKED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
    /** Quote this to support; it finds the request in the logs and in Sentry. */
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
