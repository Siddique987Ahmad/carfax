// Sentry first, so it sees everything that loads after it.
import './instrument';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApi, createApp } from './app';
import { getConfig } from './config';

async function bootstrap() {
  const config = getConfig();
  const app = await createApp();
  // Interactive API docs for developers; never in production.
  if (config.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, () => buildOpenApi(app));
  }
  await app.listen(config.PORT);
}

void bootstrap();
