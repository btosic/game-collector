import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RespondTradeDto {
  @ApiProperty({ description: 'true = accept, false = decline' })
  @IsBoolean()
  accept: boolean;
}
