import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BillService, LedgerService } from '@libs/common';
import { parseCreateBill, parseUpdateBill } from '../ledger/ledger.dto';

@ApiTags('bills')
@Controller('bills')
export class BillController {
  constructor(
    private readonly billService: BillService,
    private readonly ledger: LedgerService,
  ) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Bills and insurance totals' })
  overview() {
    return this.billService.overview();
  }

  @Get('utilities')
  @ApiOkResponse({ description: 'Utility accounts' })
  utilities() {
    return this.billService.listUtilities();
  }

  @Get('utilities/:id')
  @ApiOkResponse({ description: 'Single utility' })
  utility(@Param('id') id: string) {
    return this.billService.getUtility(id);
  }

  @Get('insurance')
  @ApiOkResponse({ description: 'Insurance policies (summary cards only)' })
  insurance() {
    return this.billService.listInsurance();
  }

  @Get('entry/:id')
  @ApiOkResponse({ description: 'Bill record for editing' })
  async entry(@Param('id') id: string) {
    const bill = (await this.ledger.snapshot()).bills.find((row) => row.id === id);
    if (!bill) {
      throw new NotFoundException(`Bill ${id} not found`);
    }
    return bill;
  }

  @Post()
  @ApiCreatedResponse({ description: 'Created utility or insurance bill' })
  create(@Body() body: unknown) {
    return this.ledger.createBill(parseCreateBill(body));
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updated bill' })
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.updateBill(id, parseUpdateBill(body));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted bill' })
  remove(@Param('id') id: string) {
    return this.ledger.deleteBill(id);
  }
}
