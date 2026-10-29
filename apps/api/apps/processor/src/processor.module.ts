import { Module } from '@nestjs/common';
import { ConfigModule } from '@libs/config';
import { BullmqModule, DragonflyModule, LoggerModule, PrismaModule } from '@libs/common';
import { HealthModule } from './health/health.module';
import { PriceSyncModule } from './price-sync/price-sync.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    DragonflyModule,
    BullmqModule,
    HealthModule,
    PriceSyncModule,
  ],
})
export class ProcessorModule {}
