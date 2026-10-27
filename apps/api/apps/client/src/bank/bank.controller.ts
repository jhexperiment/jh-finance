import { BadRequestException, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountService, IngestService, OverviewService } from '@libs/common';
import type { FastifyRequest } from 'fastify';

@ApiTags('banks')
@Controller('banks')
export class BankController {
  constructor(
    private readonly accountService: AccountService,
    private readonly overviewService: OverviewService,
    private readonly ingest: IngestService,
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

  @Post('statements')
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'Imported Bank of Hawaii statement; creates checking and savings accounts if the masks are new',
  })
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
    return this.ingest.importBankStatement({
      bytes,
      filename: file.filename,
      mimeType: file.mimetype,
      confirm: confirm === 'replace' ? 'replace' : undefined,
    });
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Single bank account' })
  get(@Param('id') id: string) {
    return this.accountService.getBank(id);
  }
}
