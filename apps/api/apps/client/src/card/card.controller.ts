import { BadRequestException, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountService, IngestService, OverviewService, TransactionService } from '@libs/common';
import type { FastifyRequest } from 'fastify';

@ApiTags('cards')
@Controller('cards')
export class CardController {
  constructor(
    private readonly accountService: AccountService,
    private readonly overviewService: OverviewService,
    private readonly transactionService: TransactionService,
    private readonly ingest: IngestService,
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

  @Post('statements')
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ description: 'Imported Chase card statement; creates the card if the last four are new' })
  async importStatement(
    @Req() request: FastifyRequest,
    @Query('confirm') confirm?: string,
  ) {
    const file = await (
      request as FastifyRequest & {
        file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string; mimetype: string } | undefined>
      }
    ).file();
    if (!file) {
      throw new BadRequestException('Choose a PDF statement');
    }
    const bytes = await file.toBuffer();
    return this.ingest.importCardStatement({
      bytes,
      filename: file.filename,
      mimeType: file.mimetype,
      confirm: confirm === 'replace' ? 'replace' : undefined,
    });
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
