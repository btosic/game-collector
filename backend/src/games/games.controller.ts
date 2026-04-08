import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { GamesService } from './games.service';
import { AddGameDto } from './dto/add-game.dto';
import { UpdateGameStatusDto } from './dto/update-game-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search games via BGG API (Redis cached 1h)' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  search(@Query('q') q: string) {
    return this.gamesService.search(q);
  }

  @Get('bgg/:id')
  @ApiOperation({ summary: 'Get full BGG game details by BGG ID' })
  getGameDetails(@Param('id') id: string) {
    return this.gamesService.getGameDetails(id);
  }

  @Get('for-trade')
  @ApiOperation({ summary: "Get all other users' FOR_TRADE games" })
  getPublicForTrade(@CurrentUser() user: User) {
    return this.gamesService.getPublicForTrade(user.id);
  }

  @Get('collection')
  @ApiOperation({ summary: "Get the current user's game collection" })
  getCollection(@CurrentUser() user: User) {
    return this.gamesService.getCollection(user.id);
  }

  @Post('collection')
  @ApiOperation({ summary: 'Add a game to your collection' })
  addToCollection(@CurrentUser() user: User, @Body() dto: AddGameDto) {
    return this.gamesService.addToCollection(user.id, dto.bggGameId, dto.status);
  }

  @Patch('collection/:id')
  @ApiOperation({ summary: 'Update game status (IN_COLLECTION / WISHLIST / FOR_TRADE)' })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateGameStatusDto,
  ) {
    return this.gamesService.updateStatus(user.id, id, dto.status);
  }

  @Delete('collection/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a game from your collection' })
  removeFromCollection(@CurrentUser() user: User, @Param('id') id: string) {
    return this.gamesService.removeFromCollection(user.id, id);
  }
}
