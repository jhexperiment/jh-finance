import { Module } from '@nestjs/common';
import { IngestModule, LedgerModule } from '@libs/common';
import { AccountWriteController } from './account-write.controller';
import { ChainAddressController } from './chain-address.controller';
import { HoldingWriteController } from './holding-write.controller';
import { TransactionWriteController } from './transaction-write.controller';

@Module({
  imports: [LedgerModule, IngestModule],
  controllers: [
    AccountWriteController,
    ChainAddressController,
    TransactionWriteController,
    HoldingWriteController,
  ],
})
export class LedgerHttpModule {}
