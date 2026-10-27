import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { HoldingService } from './holding.service';

@Module({
  imports: [LedgerModule],
  providers: [HoldingService],
  exports: [HoldingService],
})
export class HoldingModule {}
