import { Injectable } from '@nestjs/common';
import { projectBanksOverview, projectCardsOverview, projectOverview } from 'shared';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class TransactionService {
  constructor(private readonly ledger: LedgerService) {}

  async listRecent() {
    return (await projectOverview(await this.ledger.snapshot())).activity;
  }

  async listCardTransactions() {
    return (await projectCardsOverview(await this.ledger.snapshot())).transactions;
  }

  async listBankLines() {
    return (await projectBanksOverview(await this.ledger.snapshot())).lines;
  }
}
