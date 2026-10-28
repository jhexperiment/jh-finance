import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ENV, Env } from '@libs/config';

export type DecimalValue = { toString(): string } | string | number;

export type AccountRecord = {
  id: string;
  name: string;
  kind: 'CREDIT_CARD' | 'BANK' | 'INVESTMENT' | 'CRYPTO';
  subtype: string;
  mask: string | null;
  balance: DecimalValue;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionRecord = {
  id: string;
  accountId: string;
  postedAt: Date;
  description: string;
  amount: DecimalValue;
  asset: string | null;
  externalId: string | null;
  category: string | null;
  status: string | null;
  createdAt: Date;
};

export type ChainAddressRecord = {
  id: string;
  accountId: string;
  chain: string;
  address: string;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type HoldingRecord = {
  id: string;
  accountId: string;
  name: string;
  symbol: string | null;
  quantity: DecimalValue;
  value: DecimalValue;
  costBasis: DecimalValue;
  createdAt: Date;
  updatedAt: Date;
};

export type BillRecord = {
  id: string;
  name: string;
  kind: 'UTILITY' | 'INSURANCE';
  amount: DecimalValue;
  dueAt: Date | null;
  paidFromId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentRecord = {
  id: string;
  accountId: string | null;
  kind: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  byteSize: number;
  parser: string | null;
  statementDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
};

type Delegate<T> = {
  findMany: (args?: Record<string, unknown>) => Promise<T[]>;
  findUnique: (args: { where: { id: string } }) => Promise<T | null>;
  create: (args: { data: Record<string, unknown> }) => Promise<T>;
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<T>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  delete: (args: { where: { id: string } }) => Promise<T>;
};

export type DomainPrisma = {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $transaction: <T>(fn: (tx: DomainPrisma) => Promise<T>) => Promise<T>;
  account: Delegate<AccountRecord>;
  transaction: Delegate<TransactionRecord>;
  holding: Delegate<HoldingRecord>;
  bill: Delegate<BillRecord>;
  document: Delegate<DocumentRecord>;
  chainAddress: Delegate<ChainAddressRecord>;
};

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool?: Pool;
  private client?: DomainPrisma;
  private ready = false;

  constructor(@Inject(ENV) private readonly env: Env) {}

  isReady() {
    return this.ready;
  }

  get db(): DomainPrisma | undefined {
    return this.ready ? this.client : undefined;
  }

  async onModuleInit() {
    if (!this.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL missing; serving an empty workspace until the database is connected');
      return;
    }

    try {
      const { PrismaClient } = await import('../../../../generated/prisma/client');
      this.pool = new Pool({ connectionString: this.env.DATABASE_URL });
      this.client = new PrismaClient({ adapter: new PrismaPg(this.pool) }) as unknown as DomainPrisma;
      await this.client.$connect();
      this.ready = true;
    } catch (error) {
      this.logger.warn(
        `Prisma is not connected (${error instanceof Error ? error.message : 'unknown'}); serving an empty workspace`,
      );
    }
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
    await this.pool?.end();
  }
}
