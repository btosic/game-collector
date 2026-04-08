import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('market')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('products')
  @ApiOperation({ summary: 'Get premium accessories from Shopify Storefront API' })
  @ApiQuery({ name: 'first', required: false, type: Number, description: 'Number of products (default 12)' })
  getProducts(
    @Query('first', new DefaultValuePipe(12), ParseIntPipe) first: number,
  ) {
    return this.marketService.getProducts(first);
  }
}
