import { Injectable, NotFoundException } from '@nestjs/common';
import { banks, cards, findBank, findCard, investments } from 'shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  listCards() {
    return cards;
  }

  getCard(id: string) {
    const card = findCard(id);
    if (!card) {
      throw new NotFoundException(`Card ${id} not found`);
    }
    return card;
  }

  listBanks() {
    return banks;
  }

  getBank(id: string) {
    const bank = findBank(id);
    if (!bank) {
      throw new NotFoundException(`Bank account ${id} not found`);
    }
    return bank;
  }

  listInvestments() {
    return investments;
  }

  listAll() {
    return [...cards, ...banks, ...investments];
  }
}
