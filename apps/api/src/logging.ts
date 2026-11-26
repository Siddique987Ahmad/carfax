import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { redactPhoneNumbers } from '@carfax/shared';
import type { Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';
import type { Config } from './config';

/** Query parameters whose values are never logged or sent to Sentry. */
const SENSITIVE_PARAMS = /([?&](?:phone|otp|code|token|password|q)=)[^&#]*/gi;

/** Replaces sensitive query values with [redacted]: '/x?phone=0300…' → '/x?phone=[redacted]'. */
export function scrubSensitive(url: string): string {
  return url.replace(SENSITIVE_PARAMS, '$1[redacted]');
}

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * JSON logs with a request id on every line (api/01). Request and response bodies are never
 * logged, because phone numbers and OTPs travel in them; sensitive query values are scrubbed and
 * credentials removed from headers.
 */
export function loggerParams(config: Config, stream?: DestinationStream): Params {
  const options = {
    level: config.LOG_LEVEL,
    // Reuse a caller's x-request-id if it looks safe, otherwise make one; always send it back.
    genReqId(req: IncomingMessage, res: ServerResponse) {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: scrubSensitive(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.phone', '*.otp'],
      censor: '[redacted]',
    },
    // Last line of defence: phone numbers can slip in through error messages (e.g. Postgres:
    // "Key (phone)=(+92300…) already exists"), so every finished log line is scrubbed.
    hooks: { streamWrite: redactPhoneNumbers },
    // Health checks every few seconds would drown the logs.
    autoLogging: { ignore: (req: IncomingMessage) => req.url === '/v1/health' },
  } satisfies Options;
  // Tests pass an in-memory stream to check what would be written.
  return { pinoHttp: stream ? [options, stream] : options };
}
