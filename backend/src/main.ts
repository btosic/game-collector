import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
  VersioningType,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  /* ── Logger ─────────────────────────────────────────────── */
  app.useLogger(app.get(Logger));

  /* ── Global prefix & CORS ───────────────────────────────── */
  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*' });

  /* ── Validation ─────────────────────────────────────────── */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  /* ── Exception filter ───────────────────────────────────── */
  app.useGlobalFilters(new GlobalExceptionFilter());

  /* ── Serializer (exclude @Exclude() fields) ─────────────── */
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  /* ── Swagger ────────────────────────────────────────────── */
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GameCollector API')
    .setDescription('Board-game collection, trades & market API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  app.get(Logger).log(`🚀 App running on http://localhost:${port}/api`);
  app.get(Logger).log(`📖 Swagger at   http://localhost:${port}/api/docs`);
  app.get(Logger).log(`Testing... 🧪`);
}

bootstrap();
