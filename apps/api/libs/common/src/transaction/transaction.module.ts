import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { TransactionService } from './transaction.service';

@Module({
  imports: [LedgerModule],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
