import { Module } from '@nestjs/common';
import { AccountModule, IngestModule, OverviewModule, TransactionModule } from '@libs/common';
import { CardController } from './card.controller';

@Module({
  imports: [AccountModule, OverviewModule, TransactionModule, IngestModule],
  controllers: [CardController],
})
export class CardHttpModule {}
