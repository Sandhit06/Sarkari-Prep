import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    },
  });

  // Uploaded question papers can be large; the multipart parser itself is
  // capped at 25 MB, but review payloads (hundreds of questions) need headroom.
  app.useBodyParser('json', { limit: '30mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '30mb' });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = process.env.PORT || process.env.API_PORT || 4000;
  await app.listen(port);
  console.log(`🚀 SarkariPrep Full-Stack API Gateway running on http://localhost:${port}/api/v1`);
}
bootstrap();
