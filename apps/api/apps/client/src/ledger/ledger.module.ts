import { Module } from '@nestjs/common';
import { LedgerModule } from '@libs/common';
import { AccountWriteController } from './account-write.controller';
import { HoldingWriteController } from './holding-write.controller';
import { TransactionWriteController } from './transaction-write.controller';

@Module({
  imports: [LedgerModule],
  controllers: [AccountWriteController, TransactionWriteController, HoldingWriteController],
})
export class LedgerHttpModule {}
