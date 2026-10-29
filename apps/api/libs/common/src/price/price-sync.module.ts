import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PriceSyncService } from './price-sync.service';

@Module({
  imports: [LedgerModule],
  providers: [PriceSyncService],
  exports: [PriceSyncService],
})
export class PriceSyncModule {}
