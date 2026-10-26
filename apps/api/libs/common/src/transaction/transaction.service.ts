import { Injectable } from '@nestjs/common';
import { banksOverview, cardsOverview, overview } from 'shared';

@Injectable()
export class TransactionService {
  listRecent() {
    return overview.activity;
  }

  listCardTransactions() {
    return cardsOverview.transactions;
  }

  listBankLines() {
    return banksOverview.lines;
  }
}
