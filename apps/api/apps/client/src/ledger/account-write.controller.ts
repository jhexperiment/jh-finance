import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LedgerService } from '@libs/common';
import { projectAccounts } from 'shared';
import { parseCreateAccount, parseUpdateAccount } from './ledger.dto';

@ApiTags('accounts')
@Controller('accounts')
export class AccountWriteController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  @ApiOkResponse({ description: 'All accounts as summaries' })
  async list() {
    return projectAccounts(await this.ledger.snapshot());
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Single account record' })
  async get(@Param('id') id: string) {
    const account = (await this.ledger.snapshot()).accounts.find((row) => row.id === id);
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return account;
  }

  @Post()
  @ApiCreatedResponse({ description: 'Created account' })
  create(@Body() body: unknown) {
    return this.ledger.createAccount(parseCreateAccount(body));
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updated account' })
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.updateAccount(id, parseUpdateAccount(body));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted account and its activity/holdings' })
  remove(@Param('id') id: string) {
    return this.ledger.deleteAccount(id);
  }
}
