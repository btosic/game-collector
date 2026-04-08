import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GameStatus } from '../entities/collection-item.entity';

export class UpdateGameStatusDto {
  @ApiProperty({ enum: GameStatus })
  @IsEnum(GameStatus)
  status: GameStatus;
}
