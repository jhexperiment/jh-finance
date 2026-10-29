import { Module } from '@nestjs/common';
import { PriceSyncModule as PriceSyncDomainModule } from '@libs/common';
import { PriceSyncProcessor } from './price-sync.processor';

@Module({
  imports: [PriceSyncDomainModule],
  providers: [PriceSyncProcessor],
})
export class PriceSyncModule {}
