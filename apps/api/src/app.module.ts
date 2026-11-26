import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { getConfig } from './config';
import { DbModule } from './db/db.module';
import { AllExceptionsFilter } from './errors/exception.filter';
import { HealthController } from './health/health.controller';
import { loggerParams } from './logging';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    // Read lazily: building openapi.json (preview mode) must not need any environment.
    LoggerModule.forRootAsync({ useFactory: () => loggerParams(getConfig()) }),
    DbModule,
    RedisModule,
  ],
  controllers: [HealthController],
  providers: [
    // Every body, query and param with a Zod DTO is checked; failures become VALIDATION_FAILED.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Responses with a Zod DTO are checked too, so the API can't send fields it shouldn't.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
