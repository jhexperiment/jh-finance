import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HoldingService } from '@libs/common';

@ApiTags('investments')
@Controller('investments')
export class InvestmentController {
  constructor(private readonly holdingService: HoldingService) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Investments and crypto totals' })
  overview() {
    return this.holdingService.overview();
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
