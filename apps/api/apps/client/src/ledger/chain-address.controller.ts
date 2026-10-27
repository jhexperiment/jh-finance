import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IngestService, LedgerService } from '@libs/common';
import { parseCreateChainAddress } from './ledger.dto';

@ApiTags('chain-addresses')
@Controller('accounts/:accountId/chain-addresses')
export class ChainAddressController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly ingest: IngestService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Watched chain addresses on a crypto account' })
  async list(@Param('accountId') accountId: string) {
    const snapshot = await this.ledger.snapshot();
    const account = snapshot.accounts.find((row) => row.id === accountId);
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    return snapshot.chainAddresses.filter((row) => row.accountId === accountId);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Watch a public chain address' })
  create(@Param('accountId') accountId: string, @Body() body: unknown) {
    return this.ledger.createChainAddress(parseCreateChainAddress(accountId, body));
  }

  @Post(':addressId/sync')
  @ApiOkResponse({ description: 'Fetched and stored transactions for a watched address' })
  sync(@Param('addressId') addressId: string) {
    return this.ingest.syncChainAddress(addressId);
  }

  @Delete(':addressId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Stopped watching the address; stored transactions stay' })
  remove(@Param('addressId') addressId: string) {
    return this.ledger.deleteChainAddress(addressId);
  }
}
