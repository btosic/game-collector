import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { join } from 'path';
import Redis from 'ioredis';

import { RedisModule, REDIS_CLIENT } from '../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { GamesModule } from '../games/games.module';
import { TradesModule } from '../trades/trades.module';
import { MarketModule } from '../market/market.module';
import { GlobalExceptionFilter } from '../common/filters/http-exception.filter';
import { BggService, BggGameDetail } from '../games/bgg/bgg.service';

export const BGG_GAME_FIXTURE: BggGameDetail = {
  id: '174430',
  name: 'Gloomhaven',
  yearPublished: '2017',
  thumbnail: 'https://example.com/thumb.jpg',
  image: 'https://example.com/image.jpg',
  description: 'A cooperative dungeon-crawling card game.',
  minPlayers: '1',
  maxPlayers: '4',
  rating: '8.7',
};

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  redis: Redis;
}

/**
 * Creates a fully initialised NestJS application wired to the
 * gamecollector_test database and the local Redis instance.
 *
 * - dropSchema: true  → each call starts with a clean schema
 * - synchronize: true → TypeORM creates tables from entities (no migrations)
 * - BggService is replaced with a jest mock to avoid real BGG HTTP calls
 * - ThrottlerModule is configured with a high limit so tests are not throttled
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: join(__dirname, '../../.env.test'),
      }),

      ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 1000 }]),

      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USERNAME', 'gamecollector'),
          password: config.get<string>('DB_PASSWORD', 'password'),
          database: config.get<string>('DB_NAME', 'gamecollector_test'),
          synchronize: true,
          dropSchema: true,
          logging: false,
          autoLoadEntities: true,
        }),
      }),

      RedisModule,
      UsersModule,
      AuthModule,
      GamesModule,
      TradesModule,
      MarketModule,
    ],
  })
    .overrideProvider(BggService)
    .useValue({
      search: jest.fn().mockResolvedValue([BGG_GAME_FIXTURE]),
      getGame: jest.fn().mockResolvedValue(BGG_GAME_FIXTURE),
    })
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.init();

  const dataSource = moduleRef.get(DataSource);
  const redis = moduleRef.get<Redis>(REDIS_CLIENT);

  return { app, dataSource, redis };
}

/**
 * Truncates all application tables and flushes Redis.
 * Call in beforeEach to keep each test isolated.
 */
export async function clearAll(dataSource: DataSource, redis: Redis): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE trades, game_collections, users RESTART IDENTITY CASCADE',
  );
  await redis.flushdb();
}
