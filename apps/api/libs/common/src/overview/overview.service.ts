import { Injectable } from '@nestjs/common';
import { projectBanksOverview, projectCardsOverview, projectOverview } from 'shared';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class OverviewService {
  constructor(private readonly ledger: LedgerService) {}

  async snapshot() {
    return projectOverview(await this.ledger.snapshot());
  }

  async cards() {
    return projectCardsOverview(await this.ledger.snapshot());
  }

  async banks() {
    return projectBanksOverview(await this.ledger.snapshot());
  }
}
