import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OverviewService } from '@libs/common';

@ApiTags('overview')
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  @ApiOkResponse({ description: 'Workspace net-worth snapshot' })
  snapshot() {
    return this.overviewService.snapshot();
  }
}
