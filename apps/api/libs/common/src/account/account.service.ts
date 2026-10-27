import { Injectable, NotFoundException } from '@nestjs/common';
import { projectBanks, projectCards, projectInvestments } from 'shared';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class AccountService {
  constructor(private readonly ledger: LedgerService) {}

  async listCards() {
    return projectCards(await this.ledger.snapshot());
  }

  async getCard(id: string) {
    const card = (await this.listCards()).find((item) => item.id === id);
    if (!card) {
      throw new NotFoundException(`Card ${id} not found`);
    }
    return card;
  }

  async listBanks() {
    return projectBanks(await this.ledger.snapshot());
  }

  async getBank(id: string) {
    const bank = (await this.listBanks()).find((item) => item.id === id);
    if (!bank) {
      throw new NotFoundException(`Bank account ${id} not found`);
    }
    return bank;
  }

  async listInvestments() {
    return projectInvestments(await this.ledger.snapshot());
  }

  async listAll() {
    const snapshot = await this.ledger.snapshot();
    return [...projectCards(snapshot), ...projectBanks(snapshot), ...projectInvestments(snapshot)];
  }
}
