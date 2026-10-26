import {
  banks,
  cards,
  insurance,
  investments,
  utilities,
} from 'shared';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function parseUsd(value: string): string {
  return value.replace(/[^0-9.-]/g, '') || '0';
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required to seed');
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const accountRows = [
    ...cards.map((card) => ({
      id: card.id,
      name: card.name,
      kind: 'CREDIT_CARD' as const,
      subtype: card.typeLabel,
      mask: card.mask,
      balance: parseUsd(card.statementBalance),
    })),
    ...banks.map((bank) => ({
      id: bank.id,
      name: bank.name,
      kind: 'BANK' as const,
      subtype: bank.typeLabel,
      mask: bank.mask,
      balance: parseUsd(bank.balance),
    })),
    ...investments.map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind === 'crypto' ? ('CRYPTO' as const) : ('INVESTMENT' as const),
      subtype: account.typeLabel,
      mask: null,
      balance: parseUsd(account.value),
    })),
  ];

  for (const row of accountRows) {
    await prisma.account.upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
  }

  for (const utility of utilities) {
    await prisma.bill.upsert({
      where: { id: utility.id },
      create: {
        id: utility.id,
        name: utility.name,
        kind: 'UTILITY',
        amount: parseUsd(utility.lastBill),
        status: utility.status,
      },
      update: {
        name: utility.name,
        amount: parseUsd(utility.lastBill),
        status: utility.status,
      },
    });
  }

  for (const policy of insurance) {
    await prisma.bill.upsert({
      where: { id: policy.id },
      create: {
        id: policy.id,
        name: policy.name,
        kind: 'INSURANCE',
        amount: parseUsd(policy.premium),
        status: 'active',
      },
      update: {
        name: policy.name,
        amount: parseUsd(policy.premium),
      },
    });
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
