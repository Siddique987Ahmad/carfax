// Loaded first (main.ts), so Sentry can watch everything that starts after it.
import * as Sentry from '@sentry/nestjs';
import { getConfig } from './config';
import { redactPhoneNumbers } from '@carfax/shared';
import { scrubSensitive } from './logging';

const config = getConfig();

Sentry.init({
  dsn: config.SENTRY_DSN || undefined,
  enabled: Boolean(config.SENTRY_DSN),
  environment: config.NODE_ENV,
  // Sentry 11 collects bodies, headers, cookies, query values, database query values and local
  // variables by default. Phones and OTPs travel in all of these, so collect none of it.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { allow: ['user-agent', 'content-type', 'x-request-id'] },
      response: false,
    },
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
  },
  // A second line of defence, in case an integration adds request data anyway.
  beforeSend(event) {
    // Error messages can contain phone numbers (e.g. a duplicate-key error from Postgres).
    if (event.message) event.message = redactPhoneNumbers(event.message);
    for (const exception of event.exception?.values ?? []) {
      if (exception.value) exception.value = redactPhoneNumbers(exception.value);
    }
    for (const crumb of event.breadcrumbs ?? []) {
      if (crumb.message) crumb.message = redactPhoneNumbers(crumb.message);
    }
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.url) event.request.url = scrubSensitive(event.request.url);
      if (typeof event.request.query_string === 'string') {
        event.request.query_string = scrubSensitive(`?${event.request.query_string}`).slice(1);
      }
      if (event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
    }
    return event;
  },
});
