import { CHAINS, CHAIN_LABEL, NATIVE_TICKER, isChain, type Chain } from './chain/types'
import { assertWatchableKey } from './chain/xpub-key'
import { formatUsd, money, sum } from './money'
import { coinNameFor, quoteTicker } from './price/ids'
import type {
  AccountGroup,
  AccountKind,
  AccountSummary,
  ActivityRow,
  AllocationSlice,
  WatchedChainAddress,
  BankAccount,
  BanksOverview,
  BillsOverview,
  CardAccount,
  CardsOverview,
  Holding,
  HoldingToken,
  InsurancePolicy,
  InvestmentAccount,
  InvestmentsOverview,
  OverviewSnapshot,
  Tone,
  UtilityAccount,
} from './types'

export const BILL_KINDS = ['utility', 'insurance'] as const
export type BillKind = (typeof BILL_KINDS)[number]

export interface LedgerAccount {
  id: string
  name: string
  kind: AccountKind
  subtype: string
  mask?: string | null
  balance: string
  currency: string
  createdAt: string
  updatedAt: string
}

export interface LedgerTransaction {
  id: string
  accountId: string
  postedAt: string
  description: string
  amount: string
  asset?: string | null
  externalId?: string | null
  category?: string | null
  status?: string | null
  createdAt: string
}

export interface LedgerChainAddress {
  id: string
  accountId: string
  chain: string
  address: string
  lastSyncAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface LedgerHolding {
  id: string
  accountId: string
  name: string
  symbol?: string | null
  quantity: string
  value: string
  costBasis: string
  createdAt: string
  updatedAt: string
}

export interface LedgerBill {
  id: string
  name: string
  kind: BillKind
  amount: string
  dueAt?: string | null
  paidFromId?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface LedgerSnapshot {
  accounts: LedgerAccount[]
  transactions: LedgerTransaction[]
  holdings: LedgerHolding[]
  bills: LedgerBill[]
  chainAddresses: LedgerChainAddress[]
}

export interface CreateAccountInput {
  name: string
  kind: AccountKind
  subtype?: string
  mask?: string
  balance?: string
}

export interface UpdateAccountInput {
  name?: string
  subtype?: string
  mask?: string | null
  balance?: string
}

export interface MigrateAccountInput {
  toAccountId: string
}

export interface MigrateAccountResult {
  destinationId: string
  destinationKind: AccountKind
  sourceName: string
  destinationName: string
  holdingsMoved: number
  activityMoved: number
  addressesMoved: number
  addressesSkipped: number
}

export interface CreateTransactionInput {
  accountId: string
  postedAt?: string
  description: string
  amount: string
  asset?: string
  externalId?: string
  category?: string
  status?: string
}

export interface CreateChainAddressInput {
  accountId: string
  chain: string
  address: string
}

export interface UpdateTransactionInput {
  postedAt?: string
  description?: string
  amount?: string
  category?: string | null
  status?: string | null
}

export interface CreateHoldingInput {
  accountId: string
  name: string
  symbol?: string
  quantity?: string
  value: string
  costBasis?: string
}

export interface UpdateHoldingInput {
  name?: string
  symbol?: string | null
  quantity?: string
  value?: string
  costBasis?: string
}

export interface CreateBillInput {
  name: string
  kind: BillKind
  amount?: string
  dueAt?: string
  paidFromId?: string
  status?: string
}

export interface UpdateBillInput {
  name?: string
  amount?: string
  dueAt?: string | null
  paidFromId?: string | null
  status?: string
}

export const DEFAULT_SUBTYPE: Record<AccountKind, string> = {
  'credit-card': 'Credit card',
  bank: 'Checking',
  investment: 'Brokerage',
  crypto: 'Wallet',
}

export const ACCOUNT_KIND_TO_PRISMA: Record<AccountKind, string> = {
  'credit-card': 'CREDIT_CARD',
  bank: 'BANK',
  investment: 'INVESTMENT',
  crypto: 'CRYPTO',
}

export const PRISMA_KIND_TO_ACCOUNT: Record<string, AccountKind> = {
  CREDIT_CARD: 'credit-card',
  BANK: 'bank',
  INVESTMENT: 'investment',
  CRYPTO: 'crypto',
}

export const BILL_KIND_TO_PRISMA: Record<BillKind, string> = {
  utility: 'UTILITY',
  insurance: 'INSURANCE',
}

export const PRISMA_KIND_TO_BILL: Record<string, BillKind> = {
  UTILITY: 'utility',
  INSURANCE: 'insurance',
}

const SLICE_COLORS = ['#0E6B63', '#2B5BA8', '#B7791F', '#7A4E9B', '#D4A24C', '#B9BEC8']

export function emptyLedger(): LedgerSnapshot {
  return { accounts: [], transactions: [], holdings: [], bills: [], chainAddresses: [] }
}

export function newLedgerId(): string {
  return crypto.randomUUID()
}

export function parseMoneyInput(value: string | undefined, digits = 2): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return money(0).toFixed(digits)
  const normalized = trimmed.replace(/[$,\s]/g, '')
  const amount = money(normalized)
  if (!amount.isFinite()) {
    throw new Error('Enter a valid amount')
  }
  return amount.toFixed(digits)
}

export function parseDateInput(value: string | undefined): Date | null {
  const raw = value?.trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00.000Z`)
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Enter a valid date')
  }
  return date
}

export function isoFromDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString()
}

export function nowIso(): string {
  return new Date().toISOString()
}

function groupFor(kind: AccountKind): AccountGroup {
  if (kind === 'credit-card') return 'cards'
  if (kind === 'bank') return 'banks'
  if (kind === 'crypto') return 'crypto'
  return 'investments'
}

function hrefFor(account: Pick<LedgerAccount, 'id' | 'kind'>): string {
  if (account.kind === 'credit-card') return `/cards/${account.id}`
  if (account.kind === 'bank') return `/statements/${account.id}`
  return `/investments/${account.id}`
}

function formatDay(iso: string): string {
  const day = iso.slice(0, 10)
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return iso
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(year === new Date().getFullYear() ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function byPostedDesc(a: LedgerTransaction, b: LedgerTransaction): number {
  return b.postedAt.localeCompare(a.postedAt)
}

function amountTone(value: string): Tone | undefined {
  return money(value).isPositive() ? 'gain' : undefined
}

function gainTone(value: string): Tone {
  const amount = money(value)
  if (amount.isPositive()) return 'gain'
  if (amount.isNegative()) return 'loss'
  return 'muted'
}

function toActivityRow(row: LedgerTransaction, accountName?: string): ActivityRow {
  return {
    id: row.id,
    date: formatDay(row.postedAt),
    description: row.description,
    account: accountName,
    category: row.category ?? undefined,
    status: row.status ?? 'Posted',
    amount: formatActivityAmount(row),
    amountTone: amountTone(row.amount),
  }
}

function formatActivityAmount(row: LedgerTransaction): string {
  if (!row.asset) return formatUsd(row.amount)
  const amount = money(row.amount)
  const body = amount.abs().toString()
  if (amount.isNegative()) return `-${body} ${row.asset}`
  if (amount.isPositive()) return `+${body} ${row.asset}`
  return `0 ${row.asset}`
}

function chainAssetTotals(rows: LedgerTransaction[]): { asset: string; amount: ReturnType<typeof money> }[] {
  const byAsset = new Map<string, ReturnType<typeof money>>()
  for (const row of rows) {
    const asset = row.asset?.trim()
    if (!asset) continue
    byAsset.set(asset, (byAsset.get(asset) ?? money(0)).plus(row.amount))
  }
  return [...byAsset.entries()]
    .map(([asset, amount]) => ({ asset, amount }))
    .sort((left, right) => right.amount.abs().comparedTo(left.amount.abs()))
}

function formatNativeTotal(rows: { asset: string; amount: ReturnType<typeof money> }[]): string {
  const visible = rows.filter((row) => !row.amount.isZero())
  if (visible.length > 0) {
    return visible.map((row) => `${row.amount.toString()} ${row.asset}`).join(' · ')
  }
  if (rows.length > 0) return `0 ${rows[0].asset}`
  return '0'
}

function holdingQuantityTotal(rows: LedgerHolding[]): string | null {
  if (rows.length === 0) return null
  return rows
    .map((row) => {
      const unit = row.symbol?.trim() || row.name
      return `${money(row.quantity).toString()} ${unit}`
    })
    .join(' · ')
}

function accountHoldingTotal(
  account: LedgerAccount,
  txs: LedgerTransaction[],
  holdings: LedgerHolding[],
): string | null {
  const chain = chainAssetTotals(txs)
  if (chain.length > 0) return formatNativeTotal(chain)
  const lots = holdingQuantityTotal(holdings)
  if (lots) return lots
  if (account.kind === 'crypto') return '0'
  return null
}

function accountName(snapshot: LedgerSnapshot, id: string | null | undefined): string {
  if (!id) return '—'
  return snapshot.accounts.find((account) => account.id === id)?.name ?? '—'
}

function txnsFor(snapshot: LedgerSnapshot, accountId: string): LedgerTransaction[] {
  return snapshot.transactions.filter((row) => row.accountId === accountId).sort(byPostedDesc)
}

function holdingsFor(snapshot: LedgerSnapshot, accountId: string): LedgerHolding[] {
  return snapshot.holdings.filter((row) => row.accountId === accountId)
}

function chainAddressesFor(snapshot: LedgerSnapshot, accountId: string): WatchedChainAddress[] {
  return snapshot.chainAddresses
    .filter((row) => row.accountId === accountId)
    .map((row) => ({
      id: row.id,
      chain: row.chain,
      address: row.address,
      lastSyncAt: row.lastSyncAt,
    }))
}

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
}

function slicesFrom(entries: { label: string; value: number }[]): AllocationSlice[] {
  const total = entries.reduce((sumValue, entry) => sumValue + entry.value, 0)
  if (total <= 0) return []
  return entries
    .filter((entry) => entry.value > 0)
    .map((entry, index) => ({
      label: entry.label,
      pct: Math.round((entry.value / total) * 100),
      color: SLICE_COLORS[index % SLICE_COLORS.length],
    }))
}

function statusTone(status: string): Tone {
  const value = status.toLowerCase()
  if (value.includes('due') && !value.includes('paid')) return 'warn'
  if (value.includes('paid') || value.includes('ok')) return 'gain'
  return 'default'
}

export function toAccountSummary(account: LedgerAccount): AccountSummary {
  const value = formatUsd(account.balance)
  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    group: groupFor(account.kind),
    href: hrefFor(account),
    subtitle: account.mask ? `Ending ${account.mask}` : account.subtype,
    typeLabel: account.subtype,
    mask: account.mask ?? undefined,
    balance: value,
    balanceTone: account.kind === 'credit-card' && !money(account.balance).isZero() ? 'warn' : undefined,
  }
}

export function projectAccounts(snapshot: LedgerSnapshot): AccountSummary[] {
  return snapshot.accounts.map(toAccountSummary)
}

export function projectCard(account: LedgerAccount, snapshot: LedgerSnapshot): CardAccount {
  const transactions = txnsFor(snapshot, account.id).map((row) => toActivityRow(row, account.name))
  return {
    ...toAccountSummary(account),
    kind: 'credit-card',
    statementBalance: formatUsd(account.balance),
    minimumDue: '—',
    dueDate: '—',
    creditLimit: '—',
    utilization: '—',
    rewards: '—',
    rewardsHint: '',
    series: [{ label: 'Now', value: money(account.balance).abs().toNumber() }],
    seriesCaption: transactions.length
      ? countLabel(transactions.length, 'transaction')
      : 'No activity yet. Add a charge or payment, or upload a statement later.',
    details: [
      { label: 'Account type', value: account.subtype },
      { label: 'Card ending', value: account.mask || '—' },
      { label: 'Currency', value: account.currency },
    ],
    transactions,
    primaryAction: 'Add activity',
    secondaryAction: 'Edit card',
  }
}

export function projectCards(snapshot: LedgerSnapshot): CardAccount[] {
  return snapshot.accounts.filter((account) => account.kind === 'credit-card').map((account) => projectCard(account, snapshot))
}

export function projectBank(account: LedgerAccount, snapshot: LedgerSnapshot): BankAccount {
  const rows = txnsFor(snapshot, account.id)
  const activity = rows.map((row) => toActivityRow(row, account.name))
  const moneyIn = sum(rows.filter((row) => money(row.amount).isPositive()).map((row) => row.amount))
  const moneyOut = sum(rows.filter((row) => money(row.amount).isNegative()).map((row) => row.amount)).abs()
  return {
    ...toAccountSummary(account),
    kind: 'bank',
    available: formatUsd(account.balance),
    moneyIn: formatUsd(moneyIn),
    moneyOut: formatUsd(moneyOut),
    metrics: [
      { label: 'Balance', value: formatUsd(account.balance), hint: account.mask ? `Ending ${account.mask}` : account.subtype },
      { label: 'Money in', value: formatUsd(moneyIn), hint: 'Recorded credits', tone: 'gain' },
      { label: 'Money out', value: formatUsd(moneyOut), hint: 'Recorded debits' },
      {
        label: 'Net recorded',
        value: formatUsd(moneyIn.minus(moneyOut)),
        hint: countLabel(rows.length, 'line'),
        tone: moneyIn.minus(moneyOut).isNegative() ? 'loss' : 'gain',
      },
    ],
    series: [{ label: 'Now', value: money(account.balance).toNumber() }],
    seriesCaption: rows.length
      ? countLabel(rows.length, 'recorded line')
      : 'No activity yet. Add a line or upload a statement later.',
    details: [
      { label: 'Account type', value: account.subtype },
      { label: 'Mask', value: account.mask || '—' },
      { label: 'Currency', value: account.currency },
    ],
    activity,
    statementStatus: 'Manual',
    lastActivity: rows[0] ? formatDay(rows[0].postedAt) : '—',
    primaryAction: 'Add activity',
    secondaryAction: 'Edit account',
  }
}

export function projectBanks(snapshot: LedgerSnapshot): BankAccount[] {
  return snapshot.accounts.filter((account) => account.kind === 'bank').map((account) => projectBank(account, snapshot))
}

function formatQty(value: string): string {
  const amount = money(value)
  if (!amount.isFinite() || amount.isZero()) return '0'
  return amount.toFixed(8).replace(/\.?0+$/, '') || '0'
}

function nativeChainForTicker(ticker: string): Chain | null {
  const key = quoteTicker(ticker)
  return CHAINS.find((chain) => NATIVE_TICKER[chain] === key) ?? null
}

function uniqueNativeChain(ticker: string): Chain | null {
  const key = quoteTicker(ticker)
  const matches = CHAINS.filter((chain) => NATIVE_TICKER[chain] === key)
  return matches.length === 1 ? matches[0] : null
}

function transactionChain(row: LedgerTransaction): Chain | null {
  if (row.externalId?.includes('bsc-balance:') || row.externalId?.startsWith('bsc:')) return 'bsc'
  const prefix = row.externalId?.split(':')[0]
  if (prefix && isChain(prefix)) return prefix
  return nativeChainForTicker(row.asset ?? '')
}

function projectHolding(row: LedgerHolding, account: LedgerAccount, totalValue: number): Holding {
  const gain = money(row.value).minus(row.costBasis)
  const share = totalValue > 0 ? `${Math.round((money(row.value).toNumber() / totalValue) * 100)}%` : '—'
  const symbol = row.symbol?.trim() || quoteTicker(row.name) || undefined
  return {
    id: row.id,
    name: row.name,
    detail: [row.symbol, `${money(row.quantity).toString()} units`].filter(Boolean).join(' · '),
    accountId: account.id,
    accountName: account.name,
    type: 'Holding',
    share,
    value: formatUsd(row.value),
    dayPct: '—',
    dayTone: 'muted',
    totalGain: formatUsd(gain, { sign: 'always' }),
    totalGainTone: gainTone(gain.toString()),
    symbol,
    quantity: formatQty(row.quantity),
    costBasis: formatUsd(row.costBasis),
    canRemove: true,
  }
}

function chainAssetsByChain(rows: LedgerTransaction[]): Map<Chain, { ticker: string; amount: ReturnType<typeof money> }[]> {
  const nested = new Map<Chain, Map<string, ReturnType<typeof money>>>()
  const unassigned: { ticker: string; amount: string }[] = []
  for (const row of rows) {
    const ticker = quoteTicker(row.asset)
    if (!ticker) continue
    const chain = transactionChain(row)
    if (!chain) {
      unassigned.push({ ticker, amount: row.amount })
      continue
    }
    const byTicker = nested.get(chain) ?? new Map()
    byTicker.set(ticker, (byTicker.get(ticker) ?? money(0)).plus(row.amount))
    nested.set(chain, byTicker)
  }
  const fallback: Chain | undefined = nested.has('eth')
    ? 'eth'
    : nested.has('bsc')
      ? 'bsc'
      : nested.has('bnb')
        ? 'bnb'
        : nested.has('xlm')
          ? 'xlm'
          : nested.has('xrp')
            ? 'xrp'
            : undefined
  if (fallback) {
    const byTicker = nested.get(fallback) ?? new Map()
    for (const row of unassigned) {
      if (nativeChainForTicker(row.ticker)) continue
      byTicker.set(row.ticker, (byTicker.get(row.ticker) ?? money(0)).plus(row.amount))
    }
    nested.set(fallback, byTicker)
  }
  const out = new Map<Chain, { ticker: string; amount: ReturnType<typeof money> }[]>()
  for (const [chain, byTicker] of nested) {
    out.set(
      chain,
      [...byTicker.entries()]
        .map(([ticker, amount]) => ({ ticker, amount }))
        .filter((row) => !row.amount.isZero())
        .sort((left, right) => right.amount.abs().comparedTo(left.amount.abs())),
    )
  }
  return out
}

function projectHoldingGroups(
  account: LedgerAccount,
  holdingRows: LedgerHolding[],
  txRows: LedgerTransaction[],
  totalValue: number,
): Holding[] {
  const projected = holdingRows.map((row) => projectHolding(row, account, totalValue))
  if (account.kind !== 'crypto') return projected

  const byTicker = new Map<string, Holding>()
  for (const holding of projected) {
    const ticker = quoteTicker(holding.symbol || holding.name)
    if (ticker && !byTicker.has(ticker)) byTicker.set(ticker, holding)
  }
  const assets = chainAssetsByChain(txRows)
  const nestedTickers = new Set<string>()
  const groups: Holding[] = []
  const used = new Set<string>()

  for (const chain of CHAINS) {
    const rows = assets.get(chain) ?? []
    if (rows.length === 0) continue
    const native = NATIVE_TICKER[chain]
    const tokens = rows.filter((row) => row.ticker !== native)
    const nativeRow = rows.find((row) => row.ticker === native)
    if (tokens.length === 0 && !nativeRow && !byTicker.has(native)) continue
    for (const token of tokens) nestedTickers.add(token.ticker)
    const lot = nativeLotForChain(chain, native, assets, byTicker, used)
    const quantity = nativeRow ? formatQty(nativeRow.amount.toString()) : lot?.quantity ?? '0'
    groups.push({
      ...(lot ?? {
        id: `chain:${chain}`,
        name: coinNameFor(native),
        detail: `${quantity} ${native}`,
        accountId: account.id,
        accountName: account.name,
        type: 'Holding',
        share: '—',
        value: '—',
        dayPct: '—',
        dayTone: 'muted',
        totalGain: '—',
        totalGainTone: 'muted',
        canRemove: false,
      }),
      name: chain === 'bnb' || chain === 'bsc' ? CHAIN_LABEL[chain] : (lot?.name ?? coinNameFor(native)),
      symbol: native,
      quantity,
      chain,
      tokens: tokens.map((row) => holdingToken(row.ticker, row.amount.toString(), byTicker.get(row.ticker))),
    })
  }

  for (const holding of projected) {
    if (used.has(holding.id)) continue
    const ticker = quoteTicker(holding.symbol || holding.name)
    if (ticker && nestedTickers.has(ticker)) continue
    const chain = uniqueNativeChain(ticker)
    groups.push(chain ? { ...holding, chain } : holding)
  }
  return groups
}

function nativeLotForChain(
  chain: Chain,
  native: string,
  assets: Map<Chain, { ticker: string; amount: ReturnType<typeof money> }[]>,
  byTicker: Map<string, Holding>,
  used: Set<string>,
): Holding | undefined {
  const lot = byTicker.get(native)
  if (!lot || used.has(lot.id)) return undefined
  const peers = CHAINS.filter((row) => NATIVE_TICKER[row] === native)
  if (peers.length > 1) {
    const amountOn = (key: Chain) =>
      assets.get(key)?.find((row) => row.ticker === native)?.amount.abs() ?? money(0)
    const best = peers.reduce((winner, candidate) =>
      amountOn(candidate).greaterThan(amountOn(winner)) ? candidate : winner,
    )
    if (best !== chain) return undefined
  }
  used.add(lot.id)
  return lot
}

function holdingToken(ticker: string, quantity: string, lot?: Holding): HoldingToken {
  return {
    symbol: ticker,
    quantity: formatQty(quantity),
    value: lot ? lot.value : '—',
    costBasis: lot ? lot.costBasis ?? '—' : '—',
  }
}

function accountInvestedValue(account: LedgerAccount, snapshot: LedgerSnapshot): ReturnType<typeof money> {
  const rows = holdingsFor(snapshot, account.id)
  if (rows.length > 0) {
    return sum(rows.map((row) => row.value))
  }
  return money(account.balance)
}

export function projectInvestment(account: LedgerAccount, snapshot: LedgerSnapshot): InvestmentAccount {
  const holdingRows = holdingsFor(snapshot, account.id)
  const value = accountInvestedValue(account, snapshot)
  const cost = holdingRows.length > 0 ? sum(holdingRows.map((row) => row.costBasis)) : money(0)
  const gain = holdingRows.length > 0 ? value.minus(cost) : money(0)
  const holdings = holdingRows.map((row) => projectHolding(row, account, value.toNumber()))
  const txRows = txnsFor(snapshot, account.id)
  const activity = txRows.map((row) => toActivityRow(row, account.name))
  const holdingGroups = projectHoldingGroups(account, holdingRows, txRows, value.toNumber())
  const chainTotals = chainAssetTotals(txRows)
  const holdingTotal = accountHoldingTotal(account, txRows, holdingRows)
  const chainAddresses = chainAddressesFor(snapshot, account.id)
  const mix = slicesFrom(holdingRows.map((row) => ({ label: row.name, value: money(row.value).toNumber() })))
  return {
    ...toAccountSummary(account),
    kind: account.kind === 'crypto' ? 'crypto' : 'investment',
    extra: countLabel(holdingGroups.length, 'holding'),
    value: formatUsd(value),
    holdingTotal: holdingTotal ?? formatUsd(value),
    share: undefined,
    dayChange: '—',
    dayTone: 'muted',
    totalGain: holdingRows.length > 0 ? formatUsd(gain, { sign: 'always' }) : '—',
    totalGainTone: holdingRows.length > 0 ? gainTone(gain.toString()) : 'muted',
    costBasis: holdingRows.length > 0 ? formatUsd(cost) : '—',
    metrics: [
      { label: 'Value', value: formatUsd(value), hint: 'Recorded holdings' },
      {
        label: 'Total gain',
        value: holdingRows.length > 0 ? formatUsd(gain, { sign: 'always' }) : '—',
        hint: holdingRows.length > 0 ? `Cost basis ${formatUsd(cost)}` : 'Add holdings to track gain',
        tone: holdingRows.length > 0 ? gainTone(gain.toString()) : 'muted',
      },
      {
        label: 'Holdings',
        value: String(holdingGroups.length),
        hint: holdingGroups.length ? 'Positions' : 'None yet',
      },
      { label: 'Activity', value: String(activity.length), hint: activity.length ? 'Recorded lines' : 'None yet' },
    ],
    series: [{ label: 'Now', value: value.toNumber() }],
    seriesCaption: chainTotals.length
      ? 'Native total from recorded activity. Not USD.'
      : holdingRows.length
        ? 'Value from holdings. Refresh prices for a CoinGecko USD mark.'
        : 'No holdings yet. Add one or upload a statement later.',
    details: [
      { label: 'Account type', value: account.subtype },
      { label: 'Kind', value: account.kind === 'crypto' ? 'Crypto' : 'Investment' },
      { label: 'Currency', value: account.currency },
      ...(chainAddresses.length
        ? [
            {
              label: 'Watched addresses',
              value: countLabel(chainAddresses.length, 'address', 'addresses'),
            },
          ]
        : []),
    ],
    mix: mix.length > 0 ? mix : undefined,
    holdings,
    holdingGroups,
    activity,
    chainAddresses,
    primaryAction: 'Add holding',
    secondaryAction: 'Edit account',
  }
}

export function projectInvestments(snapshot: LedgerSnapshot): InvestmentAccount[] {
  const accounts = snapshot.accounts
    .filter((account) => account.kind === 'investment' || account.kind === 'crypto')
    .map((account) => projectInvestment(account, snapshot))
  const total = sum(accounts.map((account) => parseUsdNumber(account.value)))
  const totalValue = total.toNumber()
  return accounts.map((account) => ({
    ...account,
    share: totalValue > 0 ? `${Math.round((parseUsdNumber(account.value) / totalValue) * 100)}%` : '—',
  }))
}

function parseUsdNumber(value: string): number {
  return money(value.replace(/[^0-9.-]/g, '') || 0).toNumber()
}

export function projectUtility(bill: LedgerBill, snapshot: LedgerSnapshot): UtilityAccount {
  const paidFrom = accountName(snapshot, bill.paidFromId)
  return {
    id: bill.id,
    name: bill.name,
    href: `/bills/${bill.id}`,
    subtitle: 'Utility',
    paidFrom,
    nextDue: bill.dueAt ? formatDay(bill.dueAt) : '—',
    status: bill.status,
    statusTone: statusTone(bill.status),
    lastBill: formatUsd(bill.amount),
    metrics: [
      { label: 'Amount', value: formatUsd(bill.amount), hint: 'Last recorded bill' },
      { label: 'Next due', value: bill.dueAt ? formatDay(bill.dueAt) : '—', hint: bill.status },
      { label: 'Paid from', value: paidFrom, hint: bill.paidFromId ? 'Linked account' : 'Not linked' },
      { label: 'Status', value: bill.status, hint: 'Manual', tone: statusTone(bill.status) },
    ],
    series: [],
    seriesUnit: '',
    seriesCaption: 'Usage history will show after a statement import.',
    details: [
      { label: 'Type', value: 'Utility' },
      { label: 'Status', value: bill.status },
      { label: 'Paid from', value: paidFrom },
    ],
    history: [
      {
        id: bill.id,
        date: bill.dueAt ? formatDay(bill.dueAt) : '—',
        description: bill.name,
        account: paidFrom,
        status: bill.status,
        amount: formatUsd(bill.amount),
      },
    ],
    primaryAction: 'Edit bill',
    secondaryAction: 'Edit bill',
  }
}

export function projectUtilities(snapshot: LedgerSnapshot): UtilityAccount[] {
  return snapshot.bills.filter((bill) => bill.kind === 'utility').map((bill) => projectUtility(bill, snapshot))
}

export function projectInsurance(snapshot: LedgerSnapshot): InsurancePolicy[] {
  return snapshot.bills
    .filter((bill) => bill.kind === 'insurance')
    .map((bill) => ({
      id: bill.id,
      name: bill.name,
      renewal: bill.dueAt ? formatDay(bill.dueAt) : bill.status,
      premium: formatUsd(bill.amount),
      rows: [
        { label: 'Status', value: bill.status },
        { label: 'Paid from', value: accountName(snapshot, bill.paidFromId) },
      ],
    }))
}

export function projectOverview(snapshot: LedgerSnapshot): OverviewSnapshot {
  const banks = snapshot.accounts.filter((account) => account.kind === 'bank')
  const cards = snapshot.accounts.filter((account) => account.kind === 'credit-card')
  const investments = snapshot.accounts.filter((account) => account.kind === 'investment')
  const crypto = snapshot.accounts.filter((account) => account.kind === 'crypto')
  const cash = sum(banks.map((account) => account.balance))
  const cardBalances = sum(cards.map((account) => account.balance))
  const retirement = sum(investments.map((account) => accountInvestedValue(account, snapshot)))
  const cryptoValue = sum(crypto.map((account) => accountInvestedValue(account, snapshot)))
  const net = cash.plus(retirement).plus(cryptoValue).minus(cardBalances)
  const names = new Map(snapshot.accounts.map((account) => [account.id, account.name]))
  const activity = [...snapshot.transactions]
    .sort(byPostedDesc)
    .slice(0, 8)
    .map((row) => toActivityRow(row, names.get(row.accountId)))

  const attention = [
    ...cards
      .filter((account) => money(account.balance).greaterThan(0))
      .map((account) => ({
        id: `card-${account.id}`,
        title: `Card balance on ${account.name}`,
        body: `${formatUsd(account.balance)} recorded. Pay from your issuer app, or add a payment here.`,
        tone: 'warn' as const,
      })),
    ...snapshot.bills
      .filter((bill) => {
        const tone = statusTone(bill.status)
        if (tone === 'warn') return true
        if (!bill.dueAt) return false
        const due = new Date(bill.dueAt).getTime()
        const soon = Date.now() + 10 * 24 * 60 * 60 * 1000
        return due <= soon && due >= Date.now() - 24 * 60 * 60 * 1000
      })
      .map((bill) => ({
        id: `bill-${bill.id}`,
        title: `${bill.name} ${bill.status.toLowerCase()}`,
        body: `${formatUsd(bill.amount)}${bill.dueAt ? ` · ${formatDay(bill.dueAt)}` : ''}`,
        tone: 'warn' as const,
      })),
  ].slice(0, 5)

  return {
    netWorth: formatUsd(net),
    netWorthChange: snapshot.accounts.length ? 'From recorded balances' : '',
    range: '1Y',
    series: snapshot.accounts.length ? [{ label: 'Now', value: net.toNumber() }] : [],
    seriesLabels: snapshot.accounts.length ? ['', 'Now', ''] : ['', '', ''],
    cash: formatUsd(cash),
    cashHint: banks.length ? countLabel(banks.length, 'bank account') : 'No bank accounts',
    cardBalances: formatUsd(cardBalances),
    cardHint: cards.length ? countLabel(cards.length, 'card') : 'No cards',
    retirement: formatUsd(retirement),
    retirementHint: investments.length ? countLabel(investments.length, 'investment account') : 'No investment accounts',
    crypto: formatUsd(cryptoValue),
    cryptoHint: crypto.length ? countLabel(crypto.length, 'crypto account') : 'No crypto accounts',
    allocation: slicesFrom([
      { label: 'Cash', value: cash.toNumber() },
      { label: 'Investments', value: retirement.toNumber() },
      { label: 'Crypto', value: cryptoValue.toNumber() },
    ]),
    attention,
    activity,
  }
}

export function projectCardsOverview(snapshot: LedgerSnapshot): CardsOverview {
  const cards = snapshot.accounts.filter((account) => account.kind === 'credit-card')
  const cardIds = new Set(cards.map((account) => account.id))
  const transactions = snapshot.transactions.filter((row) => cardIds.has(row.accountId)).sort(byPostedDesc)
  const month = currentMonthKey()
  const thisMonth = transactions.filter((row) => monthKey(row.postedAt) === month)
  const spent = sum(thisMonth.filter((row) => money(row.amount).isNegative()).map((row) => row.amount)).abs()
  const due = sum(cards.map((account) => account.balance))
  const names = new Map(cards.map((account) => [account.id, account.name]))
  const spendByCategory = new Map<string, ReturnType<typeof money>>()
  for (const row of thisMonth.filter((item) => money(item.amount).isNegative())) {
    const label = row.category?.trim() || 'Uncategorized'
    spendByCategory.set(label, (spendByCategory.get(label) ?? money(0)).plus(money(row.amount).abs()))
  }
  const categoryEntries = [...spendByCategory.entries()].sort((a, b) => b[1].minus(a[1]).toNumber())
  const spentTotal = spent.toNumber() || 1
  return {
    spent: formatUsd(spent),
    spentHint: thisMonth.length ? countLabel(thisMonth.length, 'transaction') + ' this month' : 'No card activity this month',
    projected: formatUsd(due),
    projectedHint: cards.length ? 'Current recorded balances' : 'No cards yet',
    due: formatUsd(due),
    dueHint: cards.length ? countLabel(cards.length, 'card') : 'No cards',
    categories: categoryEntries.map(([label, amount], index) => ({
      label,
      amount: formatUsd(amount),
      pct: Math.round((amount.toNumber() / spentTotal) * 100),
      color: SLICE_COLORS[index % SLICE_COLORS.length],
    })),
    recurringNote: transactions.length
      ? 'Recurring detection needs imported history.'
      : 'Add activity or import a statement to classify spend.',
    transactions: transactions.slice(0, 12).map((row) => toActivityRow(row, names.get(row.accountId))),
  }
}

export function projectBanksOverview(snapshot: LedgerSnapshot): BanksOverview {
  const banks = snapshot.accounts.filter((account) => account.kind === 'bank')
  const bankIds = new Set(banks.map((account) => account.id))
  const lines = snapshot.transactions.filter((row) => bankIds.has(row.accountId)).sort(byPostedDesc)
  const income = sum(lines.filter((row) => money(row.amount).isPositive()).map((row) => row.amount))
  const spending = sum(lines.filter((row) => money(row.amount).isNegative()).map((row) => row.amount)).abs()
  const savings = income.isZero() ? money(0) : income.minus(spending).div(income).times(100)
  const names = new Map(banks.map((account) => [account.id, account.name]))
  const byMonth = new Map<string, { income: number; spending: number }>()
  for (const row of lines) {
    const key = monthKey(row.postedAt)
    const bucket = byMonth.get(key) ?? { income: 0, spending: 0 }
    if (money(row.amount).isPositive()) bucket.income += money(row.amount).toNumber()
    else bucket.spending += money(row.amount).abs().toNumber()
    byMonth.set(key, bucket)
  }
  const monthKeys = [...byMonth.keys()].sort().slice(-6)
  const rawPair = monthKeys.map((key) => ({
    label: monthLabel(key),
    income: byMonth.get(key)?.income ?? 0,
    spending: byMonth.get(key)?.spending ?? 0,
  }))
  const maxBar = Math.max(...rawPair.flatMap((point) => [point.income, point.spending]), 1)
  const outflowsMap = new Map<string, ReturnType<typeof money>>()
  for (const row of lines.filter((item) => money(item.amount).isNegative())) {
    const label = row.category?.trim() || row.description
    outflowsMap.set(label, (outflowsMap.get(label) ?? money(0)).plus(money(row.amount).abs()))
  }
  return {
    total: formatUsd(sum(banks.map((account) => account.balance))),
    income: formatUsd(income),
    spending: formatUsd(spending),
    savingsRate: income.isZero() ? '—' : `${savings.toFixed(0)}%`,
    savingsHint: lines.length ? 'From recorded credits and debits' : 'Add activity to compute a savings rate',
    pairSeries: rawPair.map((point) => ({
      label: point.label,
      income: Math.round((point.income / maxBar) * 140),
      spending: Math.round((point.spending / maxBar) * 140),
    })),
    outflows: [...outflowsMap.entries()]
      .sort((a, b) => b[1].minus(a[1]).toNumber())
      .slice(0, 6)
      .map(([label, amount]) => ({ label, amount: formatUsd(amount) })),
    lines: lines.slice(0, 12).map((row) => toActivityRow(row, names.get(row.accountId))),
  }
}

export function projectInvestmentsOverview(snapshot: LedgerSnapshot): InvestmentsOverview {
  const accounts = projectInvestments(snapshot)
  const cryptoAccounts = accounts.filter((account) => account.kind === 'crypto')
  const total = sum(accounts.map((account) => parseUsdNumber(account.value)))
  const holdings = accounts.flatMap((account) => account.holdings).sort((a, b) => parseUsdNumber(b.value) - parseUsdNumber(a.value))
  const cost = sum(
    snapshot.holdings
      .filter((row) => snapshot.accounts.some((account) => account.id === row.accountId && (account.kind === 'investment' || account.kind === 'crypto')))
      .map((row) => row.costBasis),
  )
  const value = sum(
    snapshot.holdings
      .filter((row) => snapshot.accounts.some((account) => account.id === row.accountId && (account.kind === 'investment' || account.kind === 'crypto')))
      .map((row) => row.value),
  )
  const gain = snapshot.holdings.length ? value.minus(cost) : money(0)
  const cryptoHoldings = snapshot.holdings.filter((row) =>
    snapshot.accounts.some((account) => account.id === row.accountId && account.kind === 'crypto'),
  )
  const cryptoGain = cryptoHoldings.length
    ? sum(cryptoHoldings.map((row) => row.value)).minus(sum(cryptoHoldings.map((row) => row.costBasis)))
    : money(0)
  return {
    total: formatUsd(total),
    totalHint: accounts.length ? countLabel(accounts.length, 'account') : 'No investment accounts',
    gain: snapshot.holdings.length ? formatUsd(gain, { sign: 'always' }) : '—',
    gainHint: snapshot.holdings.length ? `Cost basis ${formatUsd(cost)}` : 'Add holdings to track gain',
    cryptoUnrealized: cryptoHoldings.length ? formatUsd(cryptoGain, { sign: 'always' }) : formatUsd(0),
    cryptoHint: cryptoAccounts.length ? countLabel(cryptoAccounts.length, 'crypto account') : 'No crypto accounts',
    allocation: slicesFrom(accounts.map((account) => ({ label: account.name, value: parseUsdNumber(account.value) }))),
    holdings: holdings.slice(0, 12),
    callout: holdings.length
      ? {
          title: 'USD marks from CoinGecko',
          body: 'Refresh prices to value crypto holdings. Quantity still comes from chain activity or what you typed. No trades are placed.',
        }
      : {
          title: 'No holdings yet',
          body: 'Add a holding, watch a chain address, then refresh prices for a USD mark.',
        },
  }
}

export function projectBillsOverview(snapshot: LedgerSnapshot): BillsOverview {
  const utilities = snapshot.bills.filter((bill) => bill.kind === 'utility')
  const insurance = snapshot.bills.filter((bill) => bill.kind === 'insurance')
  const dueSoon = snapshot.bills.filter((bill) => {
    if (!bill.dueAt) return statusTone(bill.status) === 'warn'
    const due = new Date(bill.dueAt).getTime()
    return due <= Date.now() + 10 * 24 * 60 * 60 * 1000
  })
  const nextInsurance = [...insurance]
    .filter((bill) => bill.dueAt)
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))[0]
  const upcoming = [...snapshot.bills]
    .filter((bill) => bill.dueAt || statusTone(bill.status) === 'warn')
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
    .map((bill) => ({
      id: bill.id,
      date: bill.dueAt ? formatDay(bill.dueAt) : '—',
      description: bill.name,
      account: accountName(snapshot, bill.paidFromId),
      amount: formatUsd(bill.amount),
    }))
  return {
    utilitiesMonthly: formatUsd(sum(utilities.map((bill) => bill.amount))),
    insuranceMonthly: formatUsd(sum(insurance.map((bill) => bill.amount))),
    dueSoon: formatUsd(sum(dueSoon.map((bill) => bill.amount))),
    dueSoonHint: dueSoon.length ? countLabel(dueSoon.length, 'bill') : 'Nothing due in the next 10 days',
    nextRenewal: nextInsurance?.dueAt ? formatDay(nextInsurance.dueAt) : '—',
    nextRenewalHint: nextInsurance ? nextInsurance.name : 'No insurance renewals recorded',
    electricitySeries: [],
    upcoming,
  }
}

export function applyCreateAccount(snapshot: LedgerSnapshot, input: CreateAccountInput): LedgerAccount {
  const now = nowIso()
  const account: LedgerAccount = {
    id: newLedgerId(),
    name: input.name.trim(),
    kind: input.kind,
    subtype: (input.subtype ?? DEFAULT_SUBTYPE[input.kind]).trim() || DEFAULT_SUBTYPE[input.kind],
    mask: input.mask?.trim() || null,
    balance: parseMoneyInput(input.balance),
    currency: 'USD',
    createdAt: now,
    updatedAt: now,
  }
  snapshot.accounts.push(account)
  return account
}

export function applyUpdateAccount(account: LedgerAccount, input: UpdateAccountInput): LedgerAccount {
  if (input.name !== undefined) account.name = input.name.trim()
  if (input.subtype !== undefined) account.subtype = input.subtype.trim() || account.subtype
  if (input.mask !== undefined) account.mask = input.mask?.trim() || null
  if (input.balance !== undefined) account.balance = parseMoneyInput(input.balance)
  account.updatedAt = nowIso()
  return account
}

export function applyMigrateAccount(
  snapshot: LedgerSnapshot,
  sourceId: string,
  toAccountId: string,
): MigrateAccountResult {
  const source = snapshot.accounts.find((row) => row.id === sourceId)
  if (!source) throw new Error('Account not found')
  const destination = snapshot.accounts.find((row) => row.id === toAccountId)
  if (
    !destination ||
    destination.id === source.id ||
    destination.kind !== source.kind ||
    destination.subtype !== source.subtype
  ) {
    throw new Error('Pick another account with the same kind and type.')
  }

  const destWatch = new Set(
    snapshot.chainAddresses
      .filter((row) => row.accountId === destination.id)
      .map((row) => watchKey(row.chain, row.address)),
  )
  let addressesMoved = 0
  let addressesSkipped = 0
  for (const row of snapshot.chainAddresses) {
    if (row.accountId !== source.id) continue
    const key = watchKey(row.chain, row.address)
    if (destWatch.has(key)) {
      addressesSkipped += 1
      continue
    }
    row.accountId = destination.id
    destWatch.add(key)
    addressesMoved += 1
  }

  const destExternal = new Set(
    snapshot.transactions
      .filter((row) => row.accountId === destination.id && row.externalId)
      .map((row) => row.externalId as string),
  )
  let activityMoved = 0
  for (const row of snapshot.transactions) {
    if (row.accountId !== source.id) continue
    if (row.externalId && destExternal.has(row.externalId)) continue
    row.accountId = destination.id
    activityMoved += 1
  }

  let holdingsMoved = 0
  for (const row of snapshot.holdings) {
    if (row.accountId !== source.id) continue
    row.accountId = destination.id
    holdingsMoved += 1
  }

  for (const bill of snapshot.bills) {
    if (bill.paidFromId === source.id) bill.paidFromId = destination.id
  }

  snapshot.chainAddresses = snapshot.chainAddresses.filter((row) => row.accountId !== source.id)
  snapshot.transactions = snapshot.transactions.filter((row) => row.accountId !== source.id)
  snapshot.holdings = snapshot.holdings.filter((row) => row.accountId !== source.id)
  snapshot.accounts = snapshot.accounts.filter((row) => row.id !== source.id)

  return {
    destinationId: destination.id,
    destinationKind: destination.kind,
    sourceName: source.name,
    destinationName: destination.name,
    holdingsMoved,
    activityMoved,
    addressesMoved,
    addressesSkipped,
  }
}

export function formatMigrateNotice(result: MigrateAccountResult): string {
  const skipped = result.addressesSkipped
    ? ` (${result.addressesSkipped} already watched, skipped)`
    : ''
  return `Moved ${result.holdingsMoved} holdings, ${result.activityMoved} activity lines, and ${result.addressesMoved} watched addresses from ${result.sourceName}${skipped}. ${result.sourceName} was removed.`
}

function watchKey(chain: string, address: string): string {
  return `${chain}\0${address}`
}

export function applyCreateTransaction(snapshot: LedgerSnapshot, input: CreateTransactionInput): LedgerTransaction {
  const posted = parseDateInput(input.postedAt) ?? new Date()
  const asset = input.asset?.trim() || null
  const row: LedgerTransaction = {
    id: newLedgerId(),
    accountId: input.accountId,
    postedAt: posted.toISOString(),
    description: input.description.trim(),
    amount: parseMoneyInput(input.amount, asset ? 8 : 2),
    asset,
    externalId: input.externalId?.trim() || null,
    category: input.category?.trim() || null,
    status: input.status?.trim() || 'Posted',
    createdAt: nowIso(),
  }
  snapshot.transactions.push(row)
  return row
}

export function applyCreateChainAddress(
  snapshot: LedgerSnapshot,
  input: CreateChainAddressInput,
): LedgerChainAddress {
  const chain = input.chain.trim().toLowerCase()
  const address = input.address.trim()
  assertWatchableKey(address, chain)
  const duplicate = snapshot.chainAddresses.some(
    (row) => row.accountId === input.accountId && row.chain === chain && row.address === address,
  )
  if (duplicate) {
    throw new Error('That address is already watched on this account.')
  }
  const now = nowIso()
  const row: LedgerChainAddress = {
    id: newLedgerId(),
    accountId: input.accountId,
    chain,
    address,
    lastSyncAt: null,
    createdAt: now,
    updatedAt: now,
  }
  snapshot.chainAddresses.push(row)
  return row
}

export function applyDeleteChainAddress(snapshot: LedgerSnapshot, id: string): void {
  snapshot.chainAddresses = snapshot.chainAddresses.filter((row) => row.id !== id)
}

export function applyTouchChainAddress(row: LedgerChainAddress, lastSyncAt = nowIso()): LedgerChainAddress {
  row.lastSyncAt = lastSyncAt
  row.updatedAt = lastSyncAt
  return row
}

export function applyUpdateHolding(row: LedgerHolding, input: UpdateHoldingInput): LedgerHolding {
  if (input.name !== undefined) row.name = input.name.trim()
  if (input.symbol !== undefined) row.symbol = input.symbol?.trim() || null
  if (input.quantity !== undefined) row.quantity = parseMoneyInput(input.quantity, 8)
  if (input.value !== undefined) row.value = parseMoneyInput(input.value)
  if (input.costBasis !== undefined) row.costBasis = parseMoneyInput(input.costBasis)
  row.updatedAt = nowIso()
  return row
}

export function applyCreateHolding(snapshot: LedgerSnapshot, input: CreateHoldingInput): LedgerHolding {
  const now = nowIso()
  const row: LedgerHolding = {
    id: newLedgerId(),
    accountId: input.accountId,
    name: input.name.trim(),
    symbol: input.symbol?.trim() || null,
    quantity: parseMoneyInput(input.quantity, 8),
    value: parseMoneyInput(input.value),
    costBasis: parseMoneyInput(input.costBasis ?? input.value),
    createdAt: now,
    updatedAt: now,
  }
  snapshot.holdings.push(row)
  return row
}

export function applyCreateBill(snapshot: LedgerSnapshot, input: CreateBillInput): LedgerBill {
  const now = nowIso()
  const due = parseDateInput(input.dueAt)
  const row: LedgerBill = {
    id: newLedgerId(),
    name: input.name.trim(),
    kind: input.kind,
    amount: parseMoneyInput(input.amount),
    dueAt: due ? due.toISOString() : null,
    paidFromId: input.paidFromId?.trim() || null,
    status: input.status?.trim() || 'Upcoming',
    createdAt: now,
    updatedAt: now,
  }
  snapshot.bills.push(row)
  return row
}

export function applyUpdateBill(bill: LedgerBill, input: UpdateBillInput): LedgerBill {
  if (input.name !== undefined) bill.name = input.name.trim()
  if (input.amount !== undefined) bill.amount = parseMoneyInput(input.amount)
  if (input.dueAt !== undefined) {
    const due = parseDateInput(input.dueAt ?? undefined)
    bill.dueAt = due ? due.toISOString() : null
  }
  if (input.paidFromId !== undefined) bill.paidFromId = input.paidFromId?.trim() || null
  if (input.status !== undefined) bill.status = input.status.trim() || bill.status
  bill.updatedAt = nowIso()
  return bill
}
