export const ACCOUNT_KINDS = [
  'credit-card',
  'bank',
  'investment',
  'crypto',
] as const

export type AccountKind = (typeof ACCOUNT_KINDS)[number]

export const ACCOUNT_GROUPS = [
  'cards',
  'banks',
  'investments',
  'crypto',
] as const

export type AccountGroup = (typeof ACCOUNT_GROUPS)[number]

export type Tone = 'default' | 'gain' | 'loss' | 'warn' | 'muted'

export interface Metric {
  label: string
  value: string
  hint: string
  tone?: Tone
}

export interface SeriesPoint {
  label: string
  value: number
}

export interface PairSeriesPoint {
  label: string
  income: number
  spending: number
}

export interface AllocationSlice {
  label: string
  pct: number
  color: string
}

export interface CategorySpend {
  label: string
  amount: string
  pct: number
  color: string
}

export interface KeyValue {
  label: string
  value: string
}

export interface AttentionItem {
  id: string
  title: string
  body: string
  tone: Tone
}

export interface ActivityRow {
  id: string
  date: string
  description: string
  account?: string
  category?: string
  status?: string
  amount: string
  amountTone?: Tone
  balance?: string
  flagged?: boolean
  note?: string
}

export interface AccountSummary {
  id: string
  name: string
  kind: AccountKind
  group: AccountGroup
  href: string
  subtitle: string
  typeLabel: string
  mask?: string
  balance: string
  balanceTone?: Tone
  extra?: string
}

export interface CardAccount extends AccountSummary {
  kind: 'credit-card'
  statementBalance: string
  minimumDue: string
  dueDate: string
  creditLimit: string
  utilization: string
  rewards: string
  rewardsHint: string
  series: SeriesPoint[]
  seriesCaption: string
  details: KeyValue[]
  transactions: ActivityRow[]
  primaryAction: string
  secondaryAction: string
}

export interface BankAccount extends AccountSummary {
  kind: 'bank'
  available: string
  moneyIn?: string
  moneyInHint?: string
  moneyOut?: string
  moneyOutHint?: string
  metrics: Metric[]
  series: SeriesPoint[]
  seriesCaption: string
  details: KeyValue[]
  activity: ActivityRow[]
  statementStatus: string
  lastActivity: string
  primaryAction: string
  secondaryAction: string
}

export interface Holding {
  id: string
  name: string
  detail: string
  accountId: string
  accountName: string
  type: string
  share?: string
  value: string
  dayPct: string
  dayTone: Tone
  totalGain: string
  totalGainTone: Tone
}

export interface InvestmentAccount extends AccountSummary {
  kind: 'investment' | 'crypto'
  value: string
  dayChange: string
  dayTone: Tone
  totalGain: string
  totalGainTone: Tone
  costBasis: string
  metrics: Metric[]
  series: SeriesPoint[]
  seriesCaption: string
  details: KeyValue[]
  mix?: AllocationSlice[]
  holdings: Holding[]
  activity: ActivityRow[]
  extraTables?: { title: string; columns: string[]; rows: string[][] }[]
  callout?: { title: string; body: string }
  primaryAction: string
  secondaryAction: string
}

export interface UtilityAccount {
  id: string
  name: string
  href: string
  subtitle: string
  paidFrom: string
  nextDue: string
  status: string
  statusTone: Tone
  lastBill: string
  metrics: Metric[]
  series: SeriesPoint[]
  seriesUnit: string
  seriesCaption: string
  details: KeyValue[]
  history: ActivityRow[]
  primaryAction: string
  secondaryAction: string
}

export interface InsurancePolicy {
  id: string
  name: string
  renewal: string
  premium: string
  rows: KeyValue[]
  progress?: { label: string; pct: number; hint: string }
}

export interface OverviewSnapshot {
  netWorth: string
  netWorthChange: string
  range: '1M' | '3M' | '1Y' | 'All'
  series: SeriesPoint[]
  seriesLabels: [string, string, string]
  cash: string
  cardBalances: string
  cardHint: string
  retirement: string
  retirementHint: string
  crypto: string
  cryptoHint: string
  allocation: AllocationSlice[]
  attention: AttentionItem[]
  activity: ActivityRow[]
}

export interface CardsOverview {
  spent: string
  spentHint: string
  projected: string
  projectedHint: string
  due: string
  dueHint: string
  categories: CategorySpend[]
  recurringNote: string
  transactions: ActivityRow[]
}

export interface BanksOverview {
  total: string
  income: string
  spending: string
  savingsRate: string
  savingsHint: string
  pairSeries: PairSeriesPoint[]
  outflows: { label: string; amount: string; tone?: Tone }[]
  lines: ActivityRow[]
}

export interface InvestmentsOverview {
  total: string
  totalHint: string
  gain: string
  gainHint: string
  cryptoUnrealized: string
  cryptoHint: string
  allocation: AllocationSlice[]
  holdings: Holding[]
  callout: { title: string; body: string }
}

export interface BillsOverview {
  utilitiesMonthly: string
  insuranceMonthly: string
  dueSoon: string
  dueSoonHint: string
  nextRenewal: string
  nextRenewalHint: string
  electricitySeries: SeriesPoint[]
  upcoming: ActivityRow[]
}
