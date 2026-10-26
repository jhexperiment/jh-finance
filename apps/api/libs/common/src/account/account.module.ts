import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DragonflyModule } from '../dragonfly/dragonfly.module';
import { AccountService } from './account.service';

@Module({
  imports: [PrismaModule, DragonflyModule],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
