// main.ts — Arranque de la API
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Todas las rutas empiezan por /api (así Angular y la API no se pisan)
  app.setGlobalPrefix('api');

  // Un documento con muchos bloques puede pesar más que el límite por defecto (100 kb)
  app.useBodyParser('json', { limit: '2mb' });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API en http://localhost:${port}/api`);
}
await bootstrap();
