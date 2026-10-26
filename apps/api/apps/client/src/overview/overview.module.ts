import { Module } from '@nestjs/common';
import { OverviewModule } from '@libs/common';
import { OverviewController } from './overview.controller';

@Module({
  imports: [OverviewModule],
  controllers: [OverviewController],
})
export class OverviewHttpModule {}
