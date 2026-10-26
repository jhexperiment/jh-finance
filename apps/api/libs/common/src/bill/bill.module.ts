import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillService } from './bill.service';

@Module({
  imports: [PrismaModule],
  providers: [BillService],
  exports: [BillService],
})
export class BillModule {}
