import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ACCOUNT_KIND_TO_PRISMA,
  BILL_KIND_TO_PRISMA,
  DEFAULT_SUBTYPE,
  PRISMA_KIND_TO_ACCOUNT,
  PRISMA_KIND_TO_BILL,
  assertWatchableKey,
  emptyLedger,
  isoFromDate,
  newLedgerId,
  parseDateInput,
  parseMoneyInput,
  type CreateAccountInput,
  type CreateBillInput,
  type CreateChainAddressInput,
  type CreateHoldingInput,
  type CreateTransactionInput,
  type LedgerAccount,
  type MigrateAccountResult,
  type LedgerBill,
  type LedgerChainAddress,
  type LedgerHolding,
  type LedgerSnapshot,
  type LedgerTransaction,
  type UpdateAccountInput,
  type UpdateBillInput,
  type UpdateHoldingInput,
  type UpdateTransactionInput,
} from 'shared';
import {
  PrismaService,
  type AccountRecord,
  type BillRecord,
  type ChainAddressRecord,
  type HoldingRecord,
  type TransactionRecord,
} from '../prisma/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(): Promise<LedgerSnapshot> {
    const db = this.prisma.db;
    if (!db) return emptyLedger();

    const [accounts, transactions, holdings, bills, chainAddresses] = await Promise.all([
      db.account.findMany({ orderBy: { createdAt: 'asc' } }),
      db.transaction.findMany({ orderBy: { postedAt: 'desc' } }),
      db.holding.findMany({ orderBy: { createdAt: 'asc' } }),
      db.bill.findMany({ orderBy: { createdAt: 'asc' } }),
      db.chainAddress.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);

    return {
      accounts: accounts.map(fromAccountRecord),
      transactions: transactions.map(fromTransactionRecord),
      holdings: holdings.map(fromHoldingRecord),
      bills: bills.map(fromBillRecord),
      chainAddresses: chainAddresses.map(fromChainAddressRecord),
    };
  }

  async createAccount(input: CreateAccountInput): Promise<LedgerAccount> {
    const db = this.requireDb();
    const row = await db.account.create({
      data: {
        id: newLedgerId(),
        name: requiredName(input.name),
        kind: ACCOUNT_KIND_TO_PRISMA[input.kind],
        subtype: (input.subtype ?? DEFAULT_SUBTYPE[input.kind]).trim() || DEFAULT_SUBTYPE[input.kind],
        mask: input.mask?.trim() || null,
        balance: parseAmount(input.balance),
        currency: 'USD',
      },
    });
    return fromAccountRecord(row);
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<LedgerAccount> {
    const db = this.requireDb();
    await this.requireAccount(id);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = requiredName(input.name);
    if (input.subtype !== undefined) data.subtype = input.subtype.trim();
    if (input.mask !== undefined) data.mask = input.mask?.trim() || null;
    if (input.balance !== undefined) data.balance = parseAmount(input.balance);
    const row = await db.account.update({ where: { id }, data });
    return fromAccountRecord(row);
  }

  async deleteAccount(id: string): Promise<void> {
    const db = this.requireDb();
    await this.requireAccount(id);
    await db.account.delete({ where: { id } });
  }

  async migrateAccount(sourceId: string, toAccountId: string): Promise<MigrateAccountResult> {
    const db = this.requireDb();
    const source = await this.requireAccount(sourceId);
    const destination = await db.account.findUnique({ where: { id: toAccountId } });
    if (
      !destination ||
      destination.id === source.id ||
      destination.kind !== source.kind ||
      destination.subtype !== source.subtype
    ) {
      throw new BadRequestException('Pick another account with the same kind and type.');
    }

    const [sourceHoldings, sourceTxs, sourceWatches, destWatches, destTxs] = await Promise.all([
      db.holding.findMany({ where: { accountId: sourceId } }),
      db.transaction.findMany({ where: { accountId: sourceId } }),
      db.chainAddress.findMany({ where: { accountId: sourceId } }),
      db.chainAddress.findMany({ where: { accountId: toAccountId } }),
      db.transaction.findMany({ where: { accountId: toAccountId } }),
    ]);

    const destWatchKeys = new Set(destWatches.map((row) => `${row.chain}\0${row.address}`));
    const destExternal = new Set(
      destTxs.map((row) => row.externalId).filter((value): value is string => Boolean(value)),
    );
    const movableWatches = sourceWatches.filter(
      (row) => !destWatchKeys.has(`${row.chain}\0${row.address}`),
    );
    const movableTxs = sourceTxs.filter((row) => !row.externalId || !destExternal.has(row.externalId));

    await db.$transaction(async (tx) => {
      if (movableWatches.length > 0) {
        await tx.chainAddress.updateMany({
          where: { id: { in: movableWatches.map((row) => row.id) } },
          data: { accountId: toAccountId },
        });
      }
      if (movableTxs.length > 0) {
        await tx.transaction.updateMany({
          where: { id: { in: movableTxs.map((row) => row.id) } },
          data: { accountId: toAccountId },
        });
      }
      await tx.holding.updateMany({
        where: { accountId: sourceId },
        data: { accountId: toAccountId },
      });
      await tx.document.updateMany({
        where: { accountId: sourceId },
        data: { accountId: toAccountId },
      });
      await tx.bill.updateMany({
        where: { paidFromId: sourceId },
        data: { paidFromId: toAccountId },
      });
      await tx.account.delete({ where: { id: sourceId } });
    });

    return {
      destinationId: destination.id,
      destinationKind: PRISMA_KIND_TO_ACCOUNT[destination.kind] ?? 'bank',
      sourceName: source.name,
      destinationName: destination.name,
      holdingsMoved: sourceHoldings.length,
      activityMoved: movableTxs.length,
      addressesMoved: movableWatches.length,
      addressesSkipped: sourceWatches.length - movableWatches.length,
    };
  }

  async createTransaction(input: CreateTransactionInput): Promise<LedgerTransaction> {
    const db = this.requireDb();
    await this.requireAccount(input.accountId);
    const posted = parseDateInput(input.postedAt) ?? new Date();
    const asset = input.asset?.trim() || null;
    const row = await db.transaction.create({
      data: {
        id: newLedgerId(),
        accountId: input.accountId,
        postedAt: posted,
        description: requiredName(input.description, 'Description'),
        amount: parseAmount(input.amount, asset ? 8 : 2),
        asset,
        externalId: input.externalId?.trim() || null,
        category: input.category?.trim() || null,
        status: input.status?.trim() || 'Posted',
      },
    });
    return fromTransactionRecord(row);
  }

  async updateTransaction(id: string, input: UpdateTransactionInput): Promise<LedgerTransaction> {
    const db = this.requireDb();
    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Transaction ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.postedAt !== undefined) data.postedAt = parseDateInput(input.postedAt) ?? existing.postedAt;
    if (input.description !== undefined) data.description = requiredName(input.description, 'Description');
    if (input.amount !== undefined) data.amount = parseAmount(input.amount);
    if (input.category !== undefined) data.category = input.category?.trim() || null;
    if (input.status !== undefined) data.status = input.status?.trim() || null;
    const row = await db.transaction.update({ where: { id }, data });
    return fromTransactionRecord(row);
  }

  async deleteTransaction(id: string): Promise<void> {
    const db = this.requireDb();
    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Transaction ${id} not found`);
    await db.transaction.delete({ where: { id } });
  }

  async createHolding(input: CreateHoldingInput): Promise<LedgerHolding> {
    const db = this.requireDb();
    await this.requireAccount(input.accountId);
    const row = await db.holding.create({
      data: {
        id: newLedgerId(),
        accountId: input.accountId,
        name: requiredName(input.name),
        symbol: input.symbol?.trim() || null,
        quantity: parseAmount(input.quantity, 8),
        value: parseAmount(input.value),
        costBasis: parseAmount(input.costBasis ?? input.value),
      },
    });
    return fromHoldingRecord(row);
  }

  async updateHolding(id: string, input: UpdateHoldingInput): Promise<LedgerHolding> {
    const db = this.requireDb();
    const existing = await db.holding.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Holding ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = requiredName(input.name);
    if (input.symbol !== undefined) data.symbol = input.symbol?.trim() || null;
    if (input.quantity !== undefined) data.quantity = parseAmount(input.quantity, 8);
    if (input.value !== undefined) data.value = parseAmount(input.value);
    if (input.costBasis !== undefined) data.costBasis = parseAmount(input.costBasis);
    const row = await db.holding.update({ where: { id }, data });
    return fromHoldingRecord(row);
  }

  async deleteHolding(id: string): Promise<void> {
    const db = this.requireDb();
    const existing = await db.holding.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Holding ${id} not found`);
    await db.holding.delete({ where: { id } });
  }

  async createBill(input: CreateBillInput): Promise<LedgerBill> {
    const db = this.requireDb();
    if (input.paidFromId) await this.requireAccount(input.paidFromId);
    const due = parseDateInput(input.dueAt);
    const row = await db.bill.create({
      data: {
        id: newLedgerId(),
        name: requiredName(input.name),
        kind: BILL_KIND_TO_PRISMA[input.kind],
        amount: parseAmount(input.amount),
        dueAt: due,
        paidFromId: input.paidFromId?.trim() || null,
        status: input.status?.trim() || 'Upcoming',
      },
    });
    return fromBillRecord(row);
  }

  async updateBill(id: string, input: UpdateBillInput): Promise<LedgerBill> {
    const db = this.requireDb();
    const existing = await db.bill.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Bill ${id} not found`);
    if (input.paidFromId) await this.requireAccount(input.paidFromId);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = requiredName(input.name);
    if (input.amount !== undefined) data.amount = parseAmount(input.amount);
    if (input.dueAt !== undefined) data.dueAt = parseDateInput(input.dueAt ?? undefined);
    if (input.paidFromId !== undefined) data.paidFromId = input.paidFromId?.trim() || null;
    if (input.status !== undefined) data.status = input.status.trim() || existing.status;
    const row = await db.bill.update({ where: { id }, data });
    return fromBillRecord(row);
  }

  async deleteBill(id: string): Promise<void> {
    const db = this.requireDb();
    const existing = await db.bill.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Bill ${id} not found`);
    await db.bill.delete({ where: { id } });
  }

  async createChainAddress(input: CreateChainAddressInput): Promise<LedgerChainAddress> {
    const db = this.requireDb();
    const account = await this.requireAccount(input.accountId);
    if (account.kind !== 'CRYPTO') {
      throw new BadRequestException('Chain addresses can only be added to a crypto account.');
    }
    const chain = input.chain.trim().toLowerCase();
    const address = input.address.trim();
    try {
      assertWatchableKey(address, chain);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid address');
    }
    const existing = await db.chainAddress.findMany({
      where: { accountId: input.accountId, chain, address },
    });
    if (existing.length > 0) {
      throw new BadRequestException('That address is already watched on this account.');
    }
    const row = await db.chainAddress.create({
      data: {
        id: newLedgerId(),
        accountId: input.accountId,
        chain,
        address,
      },
    });
    return fromChainAddressRecord(row);
  }

  async deleteChainAddress(id: string): Promise<void> {
    const db = this.requireDb();
    const existing = await db.chainAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Watched address ${id} not found`);
    await db.chainAddress.delete({ where: { id } });
  }

  async touchChainAddress(id: string): Promise<LedgerChainAddress> {
    const db = this.requireDb();
    const existing = await db.chainAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Watched address ${id} not found`);
    const row = await db.chainAddress.update({
      where: { id },
      data: { lastSyncAt: new Date() },
    });
    return fromChainAddressRecord(row);
  }

  private requireDb() {
    const db = this.prisma.db;
    if (!db) {
      throw new ServiceUnavailableException('Database is not connected');
    }
    return db;
  }

  private async requireAccount(id: string) {
    const row = await this.requireDb().account.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Account ${id} not found`);
    return row;
  }
}

function decimalString(value: { toString(): string } | string | number): string {
  return typeof value === 'string' ? value : value.toString();
}

function fromAccountRecord(row: AccountRecord): LedgerAccount {
  return {
    id: row.id,
    name: row.name,
    kind: PRISMA_KIND_TO_ACCOUNT[row.kind] ?? 'bank',
    subtype: row.subtype,
    mask: row.mask,
    balance: decimalString(row.balance),
    currency: row.currency,
    createdAt: isoFromDate(row.createdAt) ?? new Date().toISOString(),
    updatedAt: isoFromDate(row.updatedAt) ?? new Date().toISOString(),
  };
}

function fromTransactionRecord(row: TransactionRecord): LedgerTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    postedAt: isoFromDate(row.postedAt) ?? new Date().toISOString(),
    description: row.description,
    amount: decimalString(row.amount),
    asset: row.asset,
    externalId: row.externalId,
    category: row.category,
    status: row.status,
    createdAt: isoFromDate(row.createdAt) ?? new Date().toISOString(),
  };
}

function fromChainAddressRecord(row: ChainAddressRecord): LedgerChainAddress {
  return {
    id: row.id,
    accountId: row.accountId,
    chain: row.chain,
    address: row.address,
    lastSyncAt: isoFromDate(row.lastSyncAt),
    createdAt: isoFromDate(row.createdAt) ?? new Date().toISOString(),
    updatedAt: isoFromDate(row.updatedAt) ?? new Date().toISOString(),
  };
}

function fromHoldingRecord(row: HoldingRecord): LedgerHolding {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    symbol: row.symbol,
    quantity: decimalString(row.quantity),
    value: decimalString(row.value),
    costBasis: decimalString(row.costBasis),
    createdAt: isoFromDate(row.createdAt) ?? new Date().toISOString(),
    updatedAt: isoFromDate(row.updatedAt) ?? new Date().toISOString(),
  };
}

function fromBillRecord(row: BillRecord): LedgerBill {
  return {
    id: row.id,
    name: row.name,
    kind: PRISMA_KIND_TO_BILL[row.kind] ?? 'utility',
    amount: decimalString(row.amount),
    dueAt: isoFromDate(row.dueAt),
    paidFromId: row.paidFromId,
    status: row.status,
    createdAt: isoFromDate(row.createdAt) ?? new Date().toISOString(),
    updatedAt: isoFromDate(row.updatedAt) ?? new Date().toISOString(),
  };
}

function requiredName(value: string, label = 'Name'): string {
  const name = value.trim();
  if (!name) throw new BadRequestException(`${label} is required`);
  return name;
}

function parseAmount(value: string | undefined, digits = 2): string {
  try {
    return parseMoneyInput(value, digits);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Enter a valid amount');
  }
}
