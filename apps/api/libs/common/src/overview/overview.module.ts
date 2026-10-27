import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { OverviewService } from './overview.service';

@Module({
  imports: [LedgerModule],
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
