import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountService, OverviewService, TransactionService } from '@libs/common';

@ApiTags('cards')
@Controller('cards')
export class CardController {
  constructor(
    private readonly accountService: AccountService,
    private readonly overviewService: OverviewService,
    private readonly transactionService: TransactionService,
  ) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Credit-card section totals' })
  overview() {
    return this.overviewService.cards();
  }

  @Get()
  @ApiOkResponse({ description: 'Credit cards' })
  list() {
    return this.accountService.listCards();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Single credit card' })
  get(@Param('id') id: string) {
    return this.accountService.getCard(id);
  }

  @Get(':id/transactions')
  @ApiOkResponse({ description: 'Card transactions (all-cards feed)' })
  transactions() {
    return this.transactionService.listCardTransactions();
  }
}
