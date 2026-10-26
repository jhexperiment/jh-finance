import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountService, OverviewService } from '@libs/common';

@ApiTags('banks')
@Controller('banks')
export class BankController {
  constructor(
    private readonly accountService: AccountService,
    private readonly overviewService: OverviewService,
  ) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Bank section totals' })
  overview() {
    return this.overviewService.banks();
  }

  @Get()
  @ApiOkResponse({ description: 'Bank accounts' })
  list() {
    return this.accountService.listBanks();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Single bank account' })
  get(@Param('id') id: string) {
    return this.accountService.getBank(id);
  }
}
