import {
  applyCreateAccount,
  applyCreateTransaction,
  applyUpdateAccount,
  type LedgerAccount,
  type LedgerSnapshot,
  type LedgerTransaction,
} from '../ledger'
import type { ParsedCardStatement } from './chase-card'
import { transactionFingerprint } from './chase-card'

export interface CardStatementImportResult {
  accountId: string
  accountName: string
  mask: string
  createdAccount: boolean
  importedCount: number
  overlapCount: number
  newBalance: string
}

export interface CardStatementOverlap {
  accountId: string
  accountName: string
  mask: string
  createdAccount: boolean
  overlapCount: number
  incomingCount: number
  newBalance: string
}

export type CardStatementCommit =
  | { status: 'imported'; result: CardStatementImportResult }
  | { status: 'overlap'; overlap: CardStatementOverlap }

export function findCardByMask(snapshot: LedgerSnapshot, mask: string): LedgerAccount | undefined {
  return snapshot.accounts.find((account) => account.kind === 'credit-card' && account.mask === mask)
}

export function overlappingTransactions(
  existing: LedgerTransaction[],
  incoming: Array<{ postedAt: string; amount: string; description: string }>,
): LedgerTransaction[] {
  const incomingFingerprints = new Set(incoming.map(transactionFingerprint))
  return existing.filter((row) => incomingFingerprints.has(transactionFingerprint(row)))
}

export function commitCardStatement(
  snapshot: LedgerSnapshot,
  parsed: ParsedCardStatement,
  options: { confirm?: 'replace' } = {},
): CardStatementCommit {
  let account = findCardByMask(snapshot, parsed.mask)
  const createdAccount = !account
  if (!account) {
    account = applyCreateAccount(snapshot, {
      name: parsed.name,
      kind: 'credit-card',
      subtype: 'Credit card',
      mask: parsed.mask,
      balance: parsed.newBalance,
    })
  }

  const existing = snapshot.transactions.filter((row) => row.accountId === account.id)
  const overlaps = overlappingTransactions(existing, parsed.transactions)
  if (overlaps.length > 0 && options.confirm !== 'replace') {
    return {
      status: 'overlap',
      overlap: {
        accountId: account.id,
        accountName: account.name,
        mask: parsed.mask,
        createdAccount,
        overlapCount: overlaps.length,
        incomingCount: parsed.transactions.length,
        newBalance: parsed.newBalance,
      },
    }
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
    status: 'imported',
    result: {
      accountId: account.id,
      accountName: account.name,
      mask: parsed.mask,
      createdAccount,
      importedCount: parsed.transactions.length,
      overlapCount: overlaps.length,
      newBalance: parsed.newBalance,
    },
  }
}
