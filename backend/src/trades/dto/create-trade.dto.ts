import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTradeDto {
  @ApiProperty({ description: 'Receiver user ID (UUID)' })
  @IsUUID()
  receiverId: string;

  @ApiProperty({ description: 'Collection entry ID of the game being offered' })
  @IsString()
  offeredGameId: string;

  @ApiProperty({ description: 'Name of the game being offered' })
  @IsString()
  offeredGameName: string;

  @ApiProperty({ description: 'Collection entry ID of the game being requested' })
  @IsString()
  requestedGameId: string;

  @ApiProperty({ description: 'Name of the game being requested' })
  @IsString()
  requestedGameName: string;
}
