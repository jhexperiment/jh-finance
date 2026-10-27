import {
  applyCreateAccount,
  applyCreateTransaction,
  applyUpdateAccount,
  type LedgerAccount,
  type LedgerSnapshot,
} from '../ledger'
import type { ParsedBankAccount, ParsedBankStatement } from './boh-bank'
import { masksMatch } from './boh-bank'
import { overlappingTransactions } from './import-card'

export interface BankStatementAccountResult {
  accountId: string
  accountName: string
  mask: string
  createdAccount: boolean
  importedCount: number
  overlapCount: number
  newBalance: string
}

export interface BankStatementImportResult {
  importedCount: number
  createdAccounts: number
  overlapCount: number
  accounts: BankStatementAccountResult[]
}

export interface BankStatementOverlap {
  accountId: string
  accountName: string
  mask: string
  createdAccount: boolean
  overlapCount: number
  incomingCount: number
  newBalance: string
}

export type BankStatementCommit =
  | { status: 'imported'; result: BankStatementImportResult }
  | { status: 'overlap'; overlap: BankStatementOverlap }

export function findBankByMask(snapshot: LedgerSnapshot, mask: string): LedgerAccount | undefined {
  const matches = snapshot.accounts.filter(
    (account) => account.kind === 'bank' && masksMatch(account.mask, mask),
  )
  if (matches.length <= 1) return matches[0]
  const digits = mask.replace(/\D/g, '')
  return (
    matches.find((account) => account.mask?.replace(/\D/g, '') === digits) ??
    matches.find((account) => (account.mask?.replace(/\D/g, '') ?? '').endsWith(digits)) ??
    matches[0]
  )
}

export function commitBankStatement(
  snapshot: LedgerSnapshot,
  parsed: ParsedBankStatement,
  options: { confirm?: 'replace' } = {},
): BankStatementCommit {
  const incomingCount = parsed.accounts.reduce((total, account) => total + account.transactions.length, 0)
  const overlapPlans = parsed.accounts.map((account) => {
    const existing = findBankByMask(snapshot, account.mask)
    const rows = existing
      ? snapshot.transactions.filter((row) => row.accountId === existing.id)
      : []
    const overlaps = overlappingTransactions(rows, account.transactions)
    return { account, existing, overlaps }
  })
  const overlapCount = overlapPlans.reduce((total, plan) => total + plan.overlaps.length, 0)

  if (overlapCount > 0 && options.confirm !== 'replace') {
    const first = overlapPlans.find((plan) => plan.overlaps.length > 0) ?? overlapPlans[0]!
    const names = overlapPlans
      .filter((plan) => plan.overlaps.length > 0)
      .map((plan) => plan.existing?.name ?? plan.account.name)
    return {
      status: 'overlap',
      overlap: {
        accountId: first.existing?.id ?? '',
        accountName: overlapLabel(names),
        mask: first.account.mask,
        createdAccount: !first.existing,
        overlapCount,
        incomingCount,
        newBalance: first.account.newBalance,
      },
    }
  }

  const results: BankStatementAccountResult[] = []
  for (const plan of overlapPlans) {
    results.push(commitAccount(snapshot, plan.account, plan.existing, plan.overlaps))
  }

  return {
    status: 'imported',
    result: {
      importedCount: results.reduce((total, row) => total + row.importedCount, 0),
      createdAccounts: results.filter((row) => row.createdAccount).length,
      overlapCount,
      accounts: results,
    },
  }
}

function commitAccount(
  snapshot: LedgerSnapshot,
  parsed: ParsedBankAccount,
  existing: LedgerAccount | undefined,
  overlaps: ReturnType<typeof overlappingTransactions>,
): BankStatementAccountResult {
  let account = existing
  const createdAccount = !account
  if (!account) {
    account = applyCreateAccount(snapshot, {
      name: parsed.name,
      kind: 'bank',
      subtype: parsed.subtype,
      mask: parsed.mask,
      balance: parsed.newBalance,
    })
  }

  if (overlaps.length > 0) {
    const overlapIds = new Set(overlaps.map((row) => row.id))
    snapshot.transactions = snapshot.transactions.filter((row) => !overlapIds.has(row.id))
  }

  for (const row of parsed.transactions) {
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      postedAt: row.postedAt.slice(0, 10),
      description: row.description,
      amount: row.amount,
      category: row.category,
      status: 'Posted',
    })
  }

  applyUpdateAccount(account, { balance: parsed.newBalance })

  return {
    accountId: account.id,
    accountName: account.name,
    mask: parsed.mask,
    createdAccount,
    importedCount: parsed.transactions.length,
    overlapCount: overlaps.length,
    newBalance: parsed.newBalance,
  }
}

function overlapLabel(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'this account'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]} and ${names.length - 1} other accounts`
}
