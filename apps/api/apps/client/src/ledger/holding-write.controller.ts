import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LedgerService } from '@libs/common';
import { parseCreateHolding, parseUpdateHolding } from './ledger.dto';

@ApiTags('holdings')
@Controller('holdings')
export class HoldingWriteController {
  constructor(private readonly ledger: LedgerService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Created holding' })
  create(@Body() body: unknown) {
    return this.ledger.createHolding(parseCreateHolding(body));
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updated holding' })
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.updateHolding(id, parseUpdateHolding(body));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted holding' })
  remove(@Param('id') id: string) {
    return this.ledger.deleteHolding(id);
  }
}
