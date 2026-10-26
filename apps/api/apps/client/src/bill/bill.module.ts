import { Module } from '@nestjs/common';
import { BillModule } from '@libs/common';
import { BillController } from './bill.controller';

@Module({
  imports: [BillModule],
  controllers: [BillController],
})
export class BillHttpModule {}
