import { getJson } from '../chain/http'
import { IndexerError, type FetchLike } from '../chain/types'
import { money } from '../money'
import { geckoIdFor, quoteTicker, stableUsdFor } from './ids'

export const COINGECKO_URL = 'https://api.coingecko.com/api/v3'

export interface FetchUsdQuotesOptions {
  apiKey?: string
  fetch?: FetchLike
  onLog?: (line: string) => void
}

export async function fetchUsdQuotes(
  tickers: string[],
  options: FetchUsdQuotesOptions = {},
): Promise<Map<string, string>> {
  const quotes = new Map<string, string>()
  const unique = [...new Set(tickers.map(quoteTicker).filter(Boolean))]
  const pending: string[] = []
  for (const ticker of unique) {
    const stable = stableUsdFor(ticker)
    if (stable) {
      quotes.set(ticker, stable)
      continue
    }
    pending.push(ticker)
  }
  if (pending.length === 0) return quotes

  const ids = pending.map((ticker) => geckoIdFor(ticker)).filter((id): id is string => Boolean(id))
  if (ids.length > 0) {
    const body = await geckoPrice(options, { ids: ids.join(',') })
    assignQuotes(quotes, pending, body)
  }

  const unknown = pending.filter((ticker) => !quotes.has(ticker))
  if (unknown.length > 0) {
    const body = await geckoPrice(options, {
      symbols: unknown.join(',').toLowerCase(),
      include_tokens: 'all',
    })
    assignQuotes(quotes, unknown, body)
  }
  return quotes
}

async function geckoPrice(
  options: FetchUsdQuotesOptions,
  query: Record<string, string>,
): Promise<Record<string, { usd?: number | string }>> {
  const params = new URLSearchParams({ vs_currencies: 'usd', ...query })
  const url = `${COINGECKO_URL}/simple/price?${params}`
  const headers: Record<string, string> = {}
  const key = options.apiKey?.trim()
  if (key) headers['x-cg-demo-api-key'] = key
  options.onLog?.(`coingecko ${params.toString()}`)
  try {
    return await getJson<Record<string, { usd?: number | string }>>(url, {
      fetch: options.fetch,
      headers,
      onLog: options.onLog,
    })
  } catch (error) {
    if (error instanceof IndexerError) {
      throw new IndexerError(
        error.status === 429
          ? 'CoinGecko rate-limited. Wait a minute and try again.'
          : `CoinGecko request failed${error.status ? ` (${error.status})` : ''}.`,
        error.status,
      )
    }
    throw error
  }
}

function assignQuotes(
  quotes: Map<string, string>,
  tickers: string[],
  body: Record<string, { usd?: number | string }>,
): void {
  const byKey = new Map<string, string>()
  for (const [key, row] of Object.entries(body)) {
    const usd = usdString(row?.usd)
    if (!usd) continue
    byKey.set(key.toLowerCase(), usd)
  }
  for (const ticker of tickers) {
    if (quotes.has(ticker)) continue
    const id = geckoIdFor(ticker)?.toLowerCase()
    const usd = (id ? byKey.get(id) : undefined) ?? byKey.get(ticker.toLowerCase())
    if (usd) quotes.set(ticker, usd)
  }
}

function usdString(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const amount = money(value)
  if (!amount.isFinite() || amount.lte(0)) return undefined
  return amount.toString()
}
