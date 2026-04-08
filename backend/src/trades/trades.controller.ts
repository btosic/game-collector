import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TradesService } from './trades.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { RespondTradeDto } from './dto/respond-trade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('trades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get('activity')
  @ApiOperation({ summary: 'Recent trade activity feed (public stream via WS)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getActivity(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.tradesService.getRecentActivity(limit);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get all trades for the authenticated user' })
  getMyTrades(@CurrentUser() user: User) {
    return this.tradesService.getMyTrades(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a trade request' })
  createTrade(@CurrentUser() user: User, @Body() dto: CreateTradeDto) {
    return this.tradesService.create(
      user.id,
      dto.receiverId,
      dto.offeredGameId,
      dto.offeredGameName,
      dto.requestedGameId,
      dto.requestedGameName,
    );
  }

  @Patch(':id/respond')
  @ApiOperation({ summary: 'Accept or decline a trade request' })
  respond(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RespondTradeDto,
  ) {
    return this.tradesService.respond(user.id, id, dto.accept);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel your pending trade request' })
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.tradesService.cancel(user.id, id);
  }
}
