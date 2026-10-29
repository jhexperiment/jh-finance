import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@libs/config';
import { PriceSyncService } from '@libs/common';

@Processor(QUEUE_NAMES.PRICE_SYNC)
export class PriceSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceSyncProcessor.name);

  constructor(private readonly priceSync: PriceSyncService) {
    super();
  }

  async process(_job: Job) {
    const result = await this.priceSync.sync();
    this.logger.log(
      `Price sync marked ${result.markedCount} holdings (${result.quotedCount} quotes)`,
    );
    return result;
  }
}
