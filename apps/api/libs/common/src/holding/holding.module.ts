import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HoldingService } from './holding.service';

@Module({
  imports: [PrismaModule],
  providers: [HoldingService],
  exports: [HoldingService],
})
export class HoldingModule {}
