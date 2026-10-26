import { Injectable, NotFoundException } from '@nestjs/common';
import { findInvestment, investments, investmentsOverview } from 'shared';

@Injectable()
export class HoldingService {
  listAccounts() {
    return investments;
  }

  getAccount(id: string) {
    const account = findInvestment(id);
    if (!account) {
      throw new NotFoundException(`Investment account ${id} not found`);
    }
    return account;
  }

  overview() {
    return investmentsOverview;
  }
}
