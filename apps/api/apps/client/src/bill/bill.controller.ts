import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BillService } from '@libs/common';

@ApiTags('bills')
@Controller('bills')
export class BillController {
  constructor(private readonly billService: BillService) {}

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
}
