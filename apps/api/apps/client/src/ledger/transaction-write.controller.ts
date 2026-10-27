import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LedgerService } from '@libs/common';
import { parseCreateTransaction, parseUpdateTransaction } from './ledger.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionWriteController {
  constructor(private readonly ledger: LedgerService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Created transaction' })
  create(@Body() body: unknown) {
    return this.ledger.createTransaction(parseCreateTransaction(body));
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updated transaction' })
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.updateTransaction(id, parseUpdateTransaction(body));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted transaction' })
  remove(@Param('id') id: string) {
    return this.ledger.deleteTransaction(id);
  }
}
