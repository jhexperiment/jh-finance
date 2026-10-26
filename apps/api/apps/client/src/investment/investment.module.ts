import { Module } from '@nestjs/common';
import { HoldingModule } from '@libs/common';
import { InvestmentController } from './investment.controller';

@Module({
  imports: [HoldingModule],
  controllers: [InvestmentController],
})
export class InvestmentHttpModule {}
