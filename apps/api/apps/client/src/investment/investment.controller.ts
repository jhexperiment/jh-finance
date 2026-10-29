import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HoldingService, PriceSyncService } from '@libs/common';

@ApiTags('investments')
@Controller('investments')
export class InvestmentController {
  constructor(
    private readonly holdingService: HoldingService,
    private readonly priceSync: PriceSyncService,
  ) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Investments and crypto totals' })
  overview() {
    return this.holdingService.overview();
  }

  @Post('prices')
  @ApiOkResponse({ description: 'Refresh crypto USD marks from CoinGecko' })
  syncPrices() {
    return this.priceSync.sync();
  }

  @Get()
  @ApiOkResponse({ description: 'Investment and crypto accounts' })
  list() {
    return this.holdingService.listAccounts();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Single investment or crypto account' })
  get(@Param('id') id: string) {
    return this.holdingService.getAccount(id);
  }
}
