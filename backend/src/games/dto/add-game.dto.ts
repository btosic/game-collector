import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GameStatus } from '../entities/collection-item.entity';

export class AddGameDto {
  @ApiProperty({ example: '174430', description: 'BGG game ID' })
  @IsString()
  bggGameId: string;

  @ApiPropertyOptional({ enum: GameStatus, default: GameStatus.IN_COLLECTION })
  @IsEnum(GameStatus)
  @IsOptional()
  status?: GameStatus;
}
