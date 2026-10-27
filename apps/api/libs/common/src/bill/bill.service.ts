import { Injectable, NotFoundException } from '@nestjs/common';
import { projectBillsOverview, projectInsurance, projectUtilities, projectUtility } from 'shared';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class BillService {
  constructor(private readonly ledger: LedgerService) {}

  async overview() {
    return projectBillsOverview(await this.ledger.snapshot());
  }

  async listUtilities() {
    return projectUtilities(await this.ledger.snapshot());
  }

  async getUtility(id: string) {
    const snapshot = await this.ledger.snapshot();
    const bill = snapshot.bills.find((item) => item.id === id && item.kind === 'utility');
    if (!bill) {
      throw new NotFoundException(`Utility ${id} not found`);
    }
    return projectUtility(bill, snapshot);
  }

  async listInsurance() {
    return projectInsurance(await this.ledger.snapshot());
  }
}
