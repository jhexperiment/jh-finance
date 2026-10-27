import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@libs/config';
import { HoldingService } from '@libs/common';

@Processor(QUEUE_NAMES.PRICE_SYNC)
export class PriceSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceSyncProcessor.name);

  constructor(private readonly holdingService: HoldingService) {
    super();
  }

  async process(_job: Job) {
    const accounts = await this.holdingService.listAccounts();
    this.logger.log(`Price sync placeholder for ${accounts.length} investment accounts`);
    return { accounts: accounts.length };
  }
}
