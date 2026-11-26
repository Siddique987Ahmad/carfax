import type { ErrorCode } from '@carfax/shared';
import { HttpException } from '@nestjs/common';

/** Throw this for an expected failure with a stable code the apps understand. */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}
