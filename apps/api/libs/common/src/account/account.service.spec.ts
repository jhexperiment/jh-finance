import { Test } from '@nestjs/testing';
import { AccountService } from './account.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { projectOverview } from 'shared';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccountService,
        LedgerService,
        { provide: PrismaService, useValue: { isReady: () => false, db: undefined } },
      ],
    }).compile();
    service = module.get(AccountService);
  });

  it('lists no credit cards in an empty workspace', async () => {
    expect(await service.listCards()).toHaveLength(0);
  });
});

describe('projectOverview', () => {
  it('reports zero net worth with no accounts', () => {
    const snapshot = projectOverview({
      accounts: [],
      transactions: [],
      holdings: [],
      bills: [],
    });
    expect(snapshot.netWorth).toBe('$0.00');
    expect(snapshot.attention).toHaveLength(0);
  });
});
