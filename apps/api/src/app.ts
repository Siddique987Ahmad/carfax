import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule, type AppModuleOptions } from './app.module';

/** Creates the API with its global setup, without listening. Used by main.ts, openapi.ts and tests. */
export async function createApp(
  options: { preview?: boolean } & AppModuleOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.register(options), {
    bufferLogs: true,
    preview: options.preview ?? false,
  });
  if (!options.preview) {
    app.useLogger(app.get(Logger));
    // Startup lines were held back (bufferLogs) until the logger existed. Flush them now: without
    // this they only come out on listen(), so an app started with init() alone (tests) loses them.
    app.flushLogs();
  }
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  return app;
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Carfax for Pakistan API')
    .setDescription(
      'Errors always have the shape { error: { code, message, details?, requestId } }. ' +
        'Codes are listed in ERROR_CODES (@carfax/shared).',
    )
    .setVersion('1')
    .addBearerAuth()
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
