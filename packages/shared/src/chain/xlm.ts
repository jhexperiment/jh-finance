import { getJson, sleep } from './http'
import { IndexerError, type ChainTx, type IndexerOptions } from './types'
import { signedAmount } from './units'

export const STELLAR_HORIZON_URL = 'https://horizon.stellar.org'
export const BLOCKDAEMON_HORIZON_URL = 'https://svc.blockdaemon.com/stellar/mainnet/native'

const MAX_PAGES = 10_000
const PAYMENT_TYPES = new Set([
  'payment',
  'path_payment_strict_send',
  'path_payment_strict_receive',
  'create_account',
  'account_merge',
])

interface HorizonLink {
  href?: string
}

interface HorizonPayment {
  transaction_successful?: boolean
  transaction_hash?: string
  created_at?: string
  type?: string
  from?: string
  to?: string
  account?: string
  funder?: string
  amount?: string
  starting_balance?: string
  asset_type?: string
  asset_code?: string
  asset_issuer?: string
}

interface HorizonPage {
  _links?: { next?: HorizonLink }
  _embedded?: { records?: HorizonPayment[] }
}

export function resolveHorizon(
  options: IndexerOptions & { blockdaemonApiKey?: string } = {},
): { url: string; headers: Record<string, string> } {
  const key = options.blockdaemonApiKey ?? ''
  if (options.horizonUrl) {
    return { url: trimSlash(options.horizonUrl), headers: options.headers ?? {} }
  }
  if (key) {
    return {
      url: BLOCKDAEMON_HORIZON_URL,
      headers: { Authorization: `Bearer ${key}`, ...options.headers },
    }
  }
  return { url: STELLAR_HORIZON_URL, headers: options.headers ?? {} }
}

export async function fetchXlmTransactions(
  address: string,
  options: IndexerOptions & { blockdaemonApiKey?: string } = {},
): Promise<ChainTx[]> {
  const horizon = resolveHorizon(options)
  const start = `${horizon.url}/accounts/${encodeURIComponent(address)}/payments?order=asc&limit=200`
  const rows: ChainTx[] = []
  let url: string | undefined = start

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) await sleep(options.delayMs ?? 0)
    if (!url) break
    const body = await getJson<HorizonPage>(url, { ...options, headers: horizon.headers })
    const records = body._embedded?.records ?? []
    for (const payment of records) {
      const row = toChainTx(address, payment)
      if (row) rows.push(row)
    }
    const next = body._links?.next?.href
    if (!next || records.length === 0 || next === url) break
    url = resolveUrl(horizon.url, next)
  }
  return rows
}

function toChainTx(address: string, payment: HorizonPayment): ChainTx | null {
  if (payment.transaction_successful === false) return null
  if (payment.type && !PAYMENT_TYPES.has(payment.type)) return null
  const from = payment.from ?? payment.funder ?? payment.account ?? ''
  const to = payment.to ?? payment.account ?? ''
  const raw = payment.amount ?? payment.starting_balance ?? '0'
  if (raw === '0') return null
  const isFrom = from === address
  const isTo = to === address
  const direction = isFrom && isTo ? 'self' : isTo ? 'in' : isFrom ? 'out' : null
  if (!direction) return null
  return {
    chain: 'xlm',
    txid: payment.transaction_hash ?? '',
    at: payment.created_at ?? '',
    from,
    to,
    asset: assetLabel(payment),
    amount: signedAmount(raw, direction),
    direction,
  }
}

function assetLabel(payment: HorizonPayment): string {
  if (!payment.asset_type || payment.asset_type === 'native') return 'XLM'
  if (payment.asset_code && payment.asset_issuer) {
    return `${payment.asset_code}-${payment.asset_issuer}`
  }
  return payment.asset_code || 'XLM'
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function resolveUrl(base: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  try {
    return new URL(href, `${base}/`).toString()
  } catch {
    throw new IndexerError(`Invalid Horizon pagination URL: ${href}`)
  }
}
