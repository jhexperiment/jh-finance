import { IndexerError, type FetchLike } from './types'

export const INDEXER_USER_AGENT = 'jh-finance'
const RETRY_STATUSES = new Set([429, 502, 503, 504])
const GATEWAY_STATUSES = new Set([502, 503, 504])
const MAX_RETRIES = 8
const MAX_GATEWAY_RETRIES = 1
const REQUEST_TIMEOUT_MS = 8_000
const MIN_GAP_MS = 1_200
const MAX_GAP_MS = 8_000

let minGapMs = MIN_GAP_MS
let nextAt = 0

export function indexerLog(options: { onLog?: (line: string) => void } | undefined, line: string): void {
  options?.onLog?.(line)
}

export function resetIndexerPace(): void {
  minGapMs = MIN_GAP_MS
  nextAt = 0
}

export async function getJson<T>(
  url: string,
  options: { fetch?: FetchLike; headers?: Record<string, string>; onLog?: (line: string) => void } = {},
): Promise<T> {
  return requestJson<T>(url, { method: 'GET', ...options })
}

export async function postJson<T>(
  url: string,
  body: unknown,
  options: { fetch?: FetchLike; headers?: Record<string, string>; onLog?: (line: string) => void } = {},
): Promise<T> {
  return requestJson<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestJson<T>(
  url: string,
  options: {
    method: string
    body?: string
    fetch?: FetchLike
    headers?: Record<string, string>
    onLog?: (line: string) => void
  },
): Promise<T> {
  const fetchFn = options.fetch ?? fetch
  const realFetch = !options.fetch
  const headers = {
    Accept: 'application/json',
    'User-Agent': INDEXER_USER_AGENT,
    ...options.headers,
  }
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (realFetch) await waitForSlot(options)
    let response: Response
    try {
      response = await fetchFn(url, {
        method: options.method,
        body: options.body,
        headers,
        signal: realFetch ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
      })
    } catch (error) {
      const timeout = isTimeoutError(error)
      const retries = timeout ? MAX_GATEWAY_RETRIES : MAX_RETRIES
      if (attempt >= retries) {
        const message = error instanceof Error ? error.message : 'fetch failed'
        throw new IndexerError(`Indexer request failed (${message})`)
      }
      const wait = timeout ? gatewayBackoffMs(attempt) : backoffMs(attempt)
      if (realFetch) slowDown(wait)
      indexerLog(options, `retry ${timeout ? 'timeout' : 'network'} in ${seconds(wait)}s ${urlPath(url)}`)
      if (realFetch) await sleep(wait)
      continue
    }
    if (response.ok) return (await response.json()) as T
    const gateway = GATEWAY_STATUSES.has(response.status)
    const retries = gateway ? MAX_GATEWAY_RETRIES : MAX_RETRIES
    const retryable = RETRY_STATUSES.has(response.status) && attempt < retries
    await response.arrayBuffer().catch(() => undefined)
    if (!retryable) {
      throw new IndexerError(`Indexer request failed (${response.status})`, response.status)
    }
    const wait = retryDelayMs(response, attempt)
    if (realFetch) slowDown(wait)
    indexerLog(options, `retry ${response.status} in ${seconds(wait)}s ${urlPath(url)}`)
    if (realFetch) await sleep(wait)
  }
  throw new IndexerError('Indexer request failed', 429)
}

async function waitForSlot(options: { onLog?: (line: string) => void }): Promise<void> {
  const wait = nextAt - Date.now()
  if (wait > 0) {
    if (wait >= 2_000) indexerLog(options, `pace ${seconds(wait)}s`)
    await sleep(wait)
  }
  nextAt = Date.now() + minGapMs
}

function slowDown(wait: number): void {
  minGapMs = Math.min(Math.max(minGapMs * 2, wait), MAX_GAP_MS)
  nextAt = Date.now() + minGapMs
}

function seconds(ms: number): number {
  return Math.max(1, Math.round(ms / 1000))
}

function urlPath(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return url
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  if (GATEWAY_STATUSES.has(response.status)) return gatewayBackoffMs(attempt)
  const header = response.headers.get('Retry-After') ?? response.headers.get('retry-after')
  if (header) {
    const value = Number(header)
    if (Number.isFinite(value) && value >= 0) return Math.min(value * 1000, 30_000)
  }
  return backoffMs(attempt)
}

function backoffMs(attempt: number): number {
  return Math.min(2_000 * 2 ** attempt, 30_000)
}

function gatewayBackoffMs(attempt: number): number {
  return Math.min(2_000 * 2 ** attempt, 8_000)
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const message = 'message' in error ? String(error.message) : ''
  return name === 'TimeoutError' || name === 'AbortError' || /aborted|timeout/i.test(message)
}
