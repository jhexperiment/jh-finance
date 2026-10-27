import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  findBankByMask,
  findCardByMask,
  newLedgerId,
  overlappingTransactions,
  parseBankStatement,
  parseCardStatement,
  ParseError,
  type BankStatementImportResult,
  type CardStatementImportResult,
  type ParsedBankStatement,
  type ParsedCardStatement,
} from 'shared';
import { ENV, Env } from '@libs/config';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractPdfText } from './pdf-text';

@Injectable()
export class IngestService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async importCardStatement(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
    confirm?: 'replace'
  }): Promise<CardStatementImportResult> {
    if (!this.prisma.db) {
      throw new ServiceUnavailableException('Database is not connected')
    }

    const parsed = await this.parseCardPdf(input.bytes, input.filename)
    const snapshot = await this.ledger.snapshot()
    const existing = findCardByMask(snapshot, parsed.mask)
    const accountTxns = existing
      ? snapshot.transactions.filter((row) => row.accountId === existing.id)
      : []
    const overlaps = overlappingTransactions(accountTxns, parsed.transactions)

    if (overlaps.length > 0 && input.confirm !== 'replace') {
      throw new HttpException(
        {
          status: 'overlap',
          accountId: existing?.id,
          accountName: existing?.name ?? parsed.name,
          mask: parsed.mask,
          createdAccount: !existing,
          overlapCount: overlaps.length,
          incomingCount: parsed.transactions.length,
          newBalance: parsed.newBalance,
        },
        HttpStatus.CONFLICT,
      )
    }

    let accountId = existing?.id
    let createdAccount = false
    if (!accountId) {
      const created = await this.ledger.createAccount({
        name: parsed.name,
        kind: 'credit-card',
        subtype: 'Credit card',
        mask: parsed.mask,
        balance: parsed.newBalance,
      })
      accountId = created.id
      createdAccount = true
    }

    if (overlaps.length > 0) {
      for (const row of overlaps) {
        await this.ledger.deleteTransaction(row.id)
      }
    }

    for (const row of parsed.transactions) {
      await this.ledger.createTransaction({
        accountId,
        postedAt: row.postedAt.slice(0, 10),
        description: row.description,
        amount: row.amount,
        category: row.category,
        status: 'Posted',
      })
    }

    const updated = await this.ledger.updateAccount(accountId, { balance: parsed.newBalance })
    await this.storeOriginal(input, parsed, [accountId], 'credit-card-statement')

    return {
      accountId,
      accountName: updated.name,
      mask: parsed.mask,
      createdAccount,
      importedCount: parsed.transactions.length,
      overlapCount: overlaps.length,
      newBalance: parsed.newBalance,
    }
  }

  async importBankStatement(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
    confirm?: 'replace'
  }): Promise<BankStatementImportResult> {
    if (!this.prisma.db) {
      throw new ServiceUnavailableException('Database is not connected')
    }

    const parsed = await this.parseBankPdf(input.bytes, input.filename)
    const snapshot = await this.ledger.snapshot()
    const incomingCount = parsed.accounts.reduce((total, account) => total + account.transactions.length, 0)
    const plans = parsed.accounts.map((account) => {
      const existing = findBankByMask(snapshot, account.mask)
      const rows = existing
        ? snapshot.transactions.filter((row) => row.accountId === existing.id)
        : []
      return {
        account,
        existing,
        overlaps: overlappingTransactions(rows, account.transactions),
      }
    })
    const overlapCount = plans.reduce((total, plan) => total + plan.overlaps.length, 0)

    if (overlapCount > 0 && input.confirm !== 'replace') {
      const first = plans.find((plan) => plan.overlaps.length > 0) ?? plans[0]!
      const names = plans
        .filter((plan) => plan.overlaps.length > 0)
        .map((plan) => plan.existing?.name ?? plan.account.name)
      throw new HttpException(
        {
          status: 'overlap',
          accountId: first.existing?.id,
          accountName: overlapLabel(names),
          mask: first.account.mask,
          createdAccount: !first.existing,
          overlapCount,
          incomingCount,
          newBalance: first.account.newBalance,
        },
        HttpStatus.CONFLICT,
      )
    }

    const accounts = []
    for (const plan of plans) {
      let accountId = plan.existing?.id
      let createdAccount = false
      if (!accountId) {
        const created = await this.ledger.createAccount({
          name: plan.account.name,
          kind: 'bank',
          subtype: plan.account.subtype,
          mask: plan.account.mask,
          balance: plan.account.newBalance,
        })
        accountId = created.id
        createdAccount = true
      }

      if (plan.overlaps.length > 0) {
        for (const row of plan.overlaps) {
          await this.ledger.deleteTransaction(row.id)
        }
      }

      for (const row of plan.account.transactions) {
        await this.ledger.createTransaction({
          accountId,
          postedAt: row.postedAt.slice(0, 10),
          description: row.description,
          amount: row.amount,
          category: row.category,
          status: 'Posted',
        })
      }

      const updated = await this.ledger.updateAccount(accountId, { balance: plan.account.newBalance })
      accounts.push({
        accountId,
        accountName: updated.name,
        mask: plan.account.mask,
        createdAccount,
        importedCount: plan.account.transactions.length,
        overlapCount: plan.overlaps.length,
        newBalance: plan.account.newBalance,
      })
    }

    await this.storeOriginal(
      input,
      parsed,
      accounts.map((row) => row.accountId),
      'bank-statement',
    )

    return {
      importedCount: accounts.reduce((total, row) => total + row.importedCount, 0),
      createdAccounts: accounts.filter((row) => row.createdAccount).length,
      overlapCount,
      accounts,
    }
  }

  private async parseCardPdf(bytes: Uint8Array, filename: string): Promise<ParsedCardStatement> {
    if (!/\.pdf$/i.test(filename)) {
      throw new BadRequestException('Upload a PDF card statement. CSV parsers are not wired yet.')
    }
    let text: string
    try {
      text = await extractPdfText(bytes)
    } catch (error) {
      throw new BadRequestException(
        `Couldn't read that PDF (${error instanceof Error ? error.message : 'unknown error'}).`,
      )
    }
    try {
      return parseCardStatement(text)
    } catch (error) {
      if (error instanceof ParseError) throw new BadRequestException(error.message)
      throw error
    }
  }

  private async parseBankPdf(bytes: Uint8Array, filename: string): Promise<ParsedBankStatement> {
    if (!/\.pdf$/i.test(filename)) {
      throw new BadRequestException('Upload a PDF bank statement. CSV parsers are not wired yet.')
    }
    let text: string
    try {
      text = await extractPdfText(bytes)
    } catch (error) {
      throw new BadRequestException(
        `Couldn't read that PDF (${error instanceof Error ? error.message : 'unknown error'}).`,
      )
    }
    try {
      return parseBankStatement(text)
    } catch (error) {
      if (error instanceof ParseError) throw new BadRequestException(error.message)
      throw error
    }
  }

  private async storeOriginal(
    input: { bytes: Uint8Array; filename: string; mimeType: string },
    parsed: { parser: string; statementDate: string | null; periodStart: string | null; periodEnd: string | null },
    accountIds: string[],
    kind: 'credit-card-statement' | 'bank-statement',
  ) {
    const extension = path.extname(input.filename) || '.pdf'
    const directory = path.resolve(this.env.DATA_DIR)
    await mkdir(directory, { recursive: true })
    const storedId = newLedgerId()
    const storedPath = path.join(directory, `${storedId}${extension}`)
    await writeFile(storedPath, input.bytes)

    const document = this.prisma.db?.document
    if (!document) return
    for (const accountId of accountIds) {
      await document.create({
        data: {
          id: newLedgerId(),
          accountId,
          kind,
          originalName: input.filename,
          storedPath,
          mimeType: input.mimeType || 'application/pdf',
          byteSize: input.bytes.byteLength,
          parser: parsed.parser,
          statementDate: parsed.statementDate ? new Date(parsed.statementDate) : null,
          periodStart: parsed.periodStart ? new Date(parsed.periodStart) : null,
          periodEnd: parsed.periodEnd ? new Date(parsed.periodEnd) : null,
        },
      })
    }
  }
}

function overlapLabel(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'this account'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]} and ${names.length - 1} other accounts`
}
