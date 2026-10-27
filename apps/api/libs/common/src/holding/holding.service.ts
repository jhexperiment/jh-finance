import { Injectable, NotFoundException } from '@nestjs/common';
import { projectInvestment, projectInvestments, projectInvestmentsOverview } from 'shared';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class HoldingService {
  constructor(private readonly ledger: LedgerService) {}

  async listAccounts() {
    return projectInvestments(await this.ledger.snapshot());
  }

  async getAccount(id: string) {
    const snapshot = await this.ledger.snapshot();
    const account = snapshot.accounts.find(
      (item) => item.id === id && (item.kind === 'investment' || item.kind === 'crypto'),
    );
    if (!account) {
      throw new NotFoundException(`Investment account ${id} not found`);
    }
    return projectInvestment(account, snapshot);
  }

  async overview() {
    return projectInvestmentsOverview(await this.ledger.snapshot());
  }
}
