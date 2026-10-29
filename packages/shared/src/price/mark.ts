import { money, sum } from '../money'
import {
  applyCreateHolding,
  applyUpdateAccount,
  applyUpdateHolding,
  parseMoneyInput,
  type LedgerHolding,
  type LedgerSnapshot,
  type LedgerTransaction,
} from '../ledger'
import { coinNameFor, isKnownCryptoTicker, quoteTicker } from './ids'

export interface CryptoPosition {
  accountId: string
  holdingId?: string
  name: string
  symbol: string
  ticker: string
  quantity: string
  costBasis?: string
}

export interface HoldingMarkPlan {
  accountId: string
  holdingId?: string
  name: string
  symbol: string
  quantity: string
  value: string
  costBasis: string
}

export interface PriceSyncResult {
  quotedCount: number
  markedCount: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  missing: string[]
}

export function collectCryptoPositions(snapshot: LedgerSnapshot): CryptoPosition[] {
  const positions: CryptoPosition[] = []
  for (const account of snapshot.accounts) {
    if (account.kind !== 'crypto' && account.kind !== 'investment') continue
    const holdings = snapshot.holdings.filter((row) => row.accountId === account.id)
    const txs = snapshot.transactions.filter((row) => row.accountId === account.id)
    const chain = account.kind === 'crypto' ? chainAssetTotals(txs) : []
    const claimed = new Set<string>()

    for (const row of chain) {
      if (row.amount.isZero() || row.amount.isNegative()) continue
      const ticker = quoteTicker(row.asset)
      if (!ticker || !isKnownCryptoTicker(ticker)) continue
      const holding = matchHolding(holdings, ticker, claimed)
      if (holding) claimed.add(holding.id)
      positions.push({
        accountId: account.id,
        holdingId: holding?.id,
        name: holding?.name || coinNameFor(ticker, row.asset),
        symbol: holding?.symbol || ticker,
        ticker,
        quantity: row.amount.toFixed(8),
        costBasis: holding?.costBasis,
      })
    }

    for (const holding of holdings) {
      if (claimed.has(holding.id)) continue
      const ticker = quoteTicker(holding.symbol || holding.name)
      if (!ticker) continue
      if (account.kind === 'investment' && !isKnownCryptoTicker(ticker)) continue
      if (money(holding.quantity).isZero() || money(holding.quantity).isNegative()) continue
      positions.push({
        accountId: account.id,
        holdingId: holding.id,
        name: holding.name,
        symbol: holding.symbol || ticker,
        ticker,
        quantity: holding.quantity,
        costBasis: holding.costBasis,
      })
    }
  }
  return positions
}

export function planHoldingMarks(
  positions: CryptoPosition[],
  quotes: Map<string, string>,
): { marks: HoldingMarkPlan[]; missing: string[] } {
  const marks: HoldingMarkPlan[] = []
  const missing: string[] = []
  for (const position of positions) {
    const price = quotes.get(position.ticker)
    if (!price) {
      if (!missing.includes(position.ticker)) missing.push(position.ticker)
      continue
    }
    const value = money(position.quantity).times(price)
    if (!value.isFinite()) continue
    marks.push({
      accountId: position.accountId,
      holdingId: position.holdingId,
      name: position.name,
      symbol: position.symbol,
      quantity: position.quantity,
      value: parseMoneyInput(value.toFixed(2)),
      costBasis: position.costBasis ?? parseMoneyInput(value.toFixed(2)),
    })
  }
  return { marks, missing }
}

export function applyHoldingMarks(snapshot: LedgerSnapshot, marks: HoldingMarkPlan[]): PriceSyncResult {
  let createdCount = 0
  let updatedCount = 0
  const touched = new Set<string>()
  for (const mark of marks) {
    const existing = mark.holdingId
      ? snapshot.holdings.find((row) => row.id === mark.holdingId)
      : undefined
    if (existing) {
      applyUpdateHolding(existing, { quantity: mark.quantity, value: mark.value })
      updatedCount += 1
    } else {
      applyCreateHolding(snapshot, {
        accountId: mark.accountId,
        name: mark.name,
        symbol: mark.symbol,
        quantity: mark.quantity,
        value: mark.value,
        costBasis: mark.costBasis,
      })
      createdCount += 1
    }
    touched.add(mark.accountId)
  }
  rollupCryptoBalances(snapshot, touched)
  return {
    quotedCount: 0,
    markedCount: marks.length,
    createdCount,
    updatedCount,
    skippedCount: 0,
    missing: [],
  }
}

function matchHolding(
  holdings: LedgerHolding[],
  ticker: string,
  claimed: Set<string>,
): LedgerHolding | undefined {
  return holdings.find((row) => {
    if (claimed.has(row.id)) return false
    return quoteTicker(row.symbol || row.name) === ticker
  })
}

function chainAssetTotals(rows: LedgerTransaction[]): { asset: string; amount: ReturnType<typeof money> }[] {
  const byAsset = new Map<string, ReturnType<typeof money>>()
  for (const row of rows) {
    const asset = row.asset?.trim()
    if (!asset) continue
    byAsset.set(asset, (byAsset.get(asset) ?? money(0)).plus(row.amount))
  }
  return [...byAsset.entries()].map(([asset, amount]) => ({ asset, amount }))
}

function rollupCryptoBalances(snapshot: LedgerSnapshot, accountIds: Set<string>): void {
  for (const account of snapshot.accounts) {
    if (!accountIds.has(account.id) || account.kind !== 'crypto') continue
    const total = sum(
      snapshot.holdings.filter((row) => row.accountId === account.id).map((row) => row.value),
    )
    applyUpdateAccount(account, { balance: total.toFixed(2) })
  }
}
