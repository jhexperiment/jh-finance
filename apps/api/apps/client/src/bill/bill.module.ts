import { Module } from '@nestjs/common';
import { BillModule, LedgerModule } from '@libs/common';
import { BillController } from './bill.controller';

@Module({
  imports: [BillModule, LedgerModule],
  controllers: [BillController],
})
export class BillHttpModule {}
