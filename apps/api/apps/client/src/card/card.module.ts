import { Module } from '@nestjs/common';
import { AccountModule, OverviewModule, TransactionModule } from '@libs/common';
import { CardController } from './card.controller';

@Module({
  imports: [AccountModule, OverviewModule, TransactionModule],
  controllers: [CardController],
})
export class CardHttpModule {}
