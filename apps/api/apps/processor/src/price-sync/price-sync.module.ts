import { Module } from '@nestjs/common';
import { HoldingModule } from '@libs/common';
import { PriceSyncProcessor } from './price-sync.processor';

@Module({
  imports: [HoldingModule],
  providers: [PriceSyncProcessor],
})
export class PriceSyncModule {}
