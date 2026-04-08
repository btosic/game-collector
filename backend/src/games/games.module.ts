import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionItem } from './entities/collection-item.entity';
import { BggService } from './bgg/bgg.service';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CollectionItem])],
  controllers: [GamesController],
  providers: [GamesService, BggService],
  exports: [GamesService],
})
export class GamesModule {}
