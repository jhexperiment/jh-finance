import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { IngestService } from './ingest.service';

@Module({
  imports: [LedgerModule],
  providers: [IngestService],
  exports: [IngestService],
})
export class IngestModule {}
