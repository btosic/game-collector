import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { GamesModule } from './games/games.module';
import { TradesModule } from './trades/trades.module';
import { MarketModule } from './market/market.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    /* ── Config ────────────────────────────────────────────── */
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    /* ── Logging (Pino) ─────────────────────────────────────── */
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          transport:
            config.get('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,
          redact: ['req.headers.authorization'],
        },
      }),
    }),

    /* ── Rate Limiting ──────────────────────────────────────── */
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 120 },
    ]),

    /* ── Database ───────────────────────────────────────────── */
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'gamecollector'),
        password: config.get<string>('DB_PASSWORD', 'password'),
        database: config.get<string>('DB_NAME', 'gamecollector'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        migrationsRun: true,
        logging: config.get<string>('NODE_ENV') === 'development',
        autoLoadEntities: true,
      }),
    }),

    /* ── Redis ──────────────────────────────────────────────── */
    RedisModule,

    /* ── Feature modules ────────────────────────────────────── */
    UsersModule,
    AuthModule,
    GamesModule,
    TradesModule,
    MarketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
