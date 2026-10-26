import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ENV, Env, QUEUE_NAMES } from '@libs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        connection: { url: env.DRAGONFLY_URL, maxRetriesPerRequest: null },
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.PRICE_SYNC }),
  ],
  exports: [BullModule],
})
export class BullmqModule {}
