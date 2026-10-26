import { Test } from '@nestjs/testing';
import { AccountService } from './account.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: { isReady: () => false } },
      ],
    }).compile();
    service = module.get(AccountService);
  });

  it('lists four credit cards from fixtures', () => {
    expect(service.listCards()).toHaveLength(4);
  });
});
