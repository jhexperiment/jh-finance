import { Module } from '@nestjs/common';
import { AccountModule, IngestModule, OverviewModule } from '@libs/common';
import { BankController } from './bank.controller';

@Module({
  imports: [AccountModule, OverviewModule, IngestModule],
  controllers: [BankController],
})
export class BankHttpModule {}
