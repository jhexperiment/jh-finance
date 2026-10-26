import { Module } from '@nestjs/common';
import { ConfigModule } from '@libs/config';
import {
  AccountModule,
  BillModule,
  BullmqModule,
  DragonflyModule,
  HoldingModule,
  LoggerModule,
  OverviewModule,
  PrismaModule,
  TransactionModule,
} from '@libs/common';
import { HealthModule } from './health/health.module';
import { OverviewHttpModule } from './overview/overview.module';
import { CardHttpModule } from './card/card.module';
import { BankHttpModule } from './bank/bank.module';
import { InvestmentHttpModule } from './investment/investment.module';
import { BillHttpModule } from './bill/bill.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    DragonflyModule,
    BullmqModule,
    AccountModule,
    TransactionModule,
    HoldingModule,
    BillModule,
    OverviewModule,
    HealthModule,
    OverviewHttpModule,
    CardHttpModule,
    BankHttpModule,
    InvestmentHttpModule,
    BillHttpModule,
  ],
})
export class ClientModule {}
