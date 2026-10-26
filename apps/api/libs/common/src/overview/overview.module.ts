import { Module } from '@nestjs/common';
import { OverviewService } from './overview.service';

@Module({
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
