import { Module } from '@nestjs/common';
import { HoldingModule, PriceSyncModule } from '@libs/common';
import { InvestmentController } from './investment.controller';

@Module({
  imports: [HoldingModule, PriceSyncModule],
  controllers: [InvestmentController],
})
export class InvestmentHttpModule {}
