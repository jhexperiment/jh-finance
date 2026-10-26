import { Module } from '@nestjs/common';
import { AccountModule, OverviewModule } from '@libs/common';
import { BankController } from './bank.controller';

@Module({
  imports: [AccountModule, OverviewModule],
  controllers: [BankController],
})
export class BankHttpModule {}
