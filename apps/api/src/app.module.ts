import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import type { DestinationStream } from 'pino';
import { AccessGuard } from './access/access.guard';
import { AuthModule } from './auth/auth.module';
import { getConfig } from './config';
import { DbModule } from './db/db.module';
import { AllExceptionsFilter } from './errors/exception.filter';
import { GaragesModule } from './garages/garages.module';
import { HealthController } from './health/health.controller';
import { loggerParams } from './logging';
import { MessagingModule } from './messaging/messaging.module';
import { RedisModule } from './redis/redis.module';

export interface AppModuleOptions {
  /** Where logs go; tests pass an in-memory stream. Defaults to stdout. */
  logStream?: DestinationStream;
  /** Extra modules, e.g. test-only controllers. */
  imports?: Type[];
}

@Module({
  imports: [
    SentryModule.forRoot(),
    DbModule,
    RedisModule,
    MessagingModule,
    AuthModule,
    GaragesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Every route must declare who may call it (api/04); routes without a rule are refused.
    { provide: APP_GUARD, useClass: AccessGuard },
    // Every body, query and param with a Zod DTO is checked; failures become VALIDATION_FAILED.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Responses with a Zod DTO are checked too, so the API can't send fields it shouldn't.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {
  static register(options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // Read lazily: building openapi.json (preview mode) must not need any environment.
        LoggerModule.forRootAsync({
          useFactory: () => loggerParams(getConfig(), options.logStream),
        }),
        ...(options.imports ?? []),
      ],
    };
  }
}
