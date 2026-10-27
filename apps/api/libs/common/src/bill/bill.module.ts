import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { BillService } from './bill.service';

@Module({
  imports: [LedgerModule],
  providers: [BillService],
  exports: [BillService],
})
export class BillModule {}
