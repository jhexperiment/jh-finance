import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountService } from './account.service';

@Module({
  imports: [LedgerModule],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
