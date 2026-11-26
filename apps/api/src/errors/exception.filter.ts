import type { ApiError, ErrorCode } from '@carfax/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppError } from './app-error';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Every failure leaves the API in one shape: { error: { code, message, details?, requestId } }.
 * Unexpected errors become a 500 with a generic message (no internals leak) and go to Sentry
 * with the request id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const requestId = String(req.id ?? res.getHeader('x-request-id') ?? 'unknown');

    let status = 500;
    let code: ErrorCode = 'INTERNAL';
    let message = 'Something went wrong. Quote the request id to support.';
    let details: unknown;

    if (exception instanceof ZodValidationException) {
      status = 400;
      code = 'VALIDATION_FAILED';
      message = 'The request has invalid or missing fields';
      const zodError = exception.getZodError();
      if (zodError instanceof ZodError) {
        // Path and reason only: never echo the submitted values back (they may be phone numbers).
        details = zodError.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
          message: i.message,
        }));
      }
    } else if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
      if (status < 500) message = exception.message;
    }

    if (status >= 500) {
      this.logger.error({ requestId, err: exception }, 'unhandled error');
      Sentry.withScope((scope) => {
        scope.setTag('request_id', requestId);
        Sentry.captureException(exception);
      });
    }

    const body: ApiError = {
      error: { code, message, requestId, ...(details === undefined ? {} : { details }) },
    };
    res.status(status).json(body);
  }
}
