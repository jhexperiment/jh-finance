import { postJson, sleep } from './http'
import { IndexerError, type ChainTx, type IndexerOptions } from './types'
import { fromBaseUnits, signedAmount } from './units'

export const XRPL_URL = 'https://xrplcluster.com'

const MAX_PAGES = 10_000
const RIPPLE_EPOCH = 946684800

interface XrpAmountObject {
  currency?: string
  issuer?: string
  value?: string
}

type XrpAmount = string | XrpAmountObject

interface XrpTxJson {
  Account?: string
  Destination?: string
  TransactionType?: string
  Amount?: XrpAmount
  date?: number
}

interface XrpMeta {
  TransactionResult?: string
  delivered_amount?: XrpAmount
}

interface XrpTransaction {
  hash?: string
  close_time_iso?: string
  tx_json?: XrpTxJson
  meta?: XrpMeta
}

interface XrpAccountTxResult {
  result?: {
    transactions?: XrpTransaction[]
    marker?: unknown
    status?: string
    error?: string
    error_message?: string
  }
}

export async function fetchXrpTransactions(
  address: string,
  options: IndexerOptions = {},
): Promise<ChainTx[]> {
  const base = options.baseUrl ?? XRPL_URL
  const rows: ChainTx[] = []
  let marker: unknown
  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) await sleep(options.delayMs ?? 0)
    const params: Record<string, unknown> = {
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 200,
      binary: false,
      forward: true,
      api_version: 2,
    }
    if (marker) params.marker = marker
    const body = await postJson<XrpAccountTxResult>(
      base,
      { method: 'account_tx', params: [params] },
      options,
    )
    const result = body.result
    if (result?.error) {
      throw new IndexerError(result.error_message || result.error)
    }
    const txs = result?.transactions ?? []
    for (const tx of txs) {
      const row = toChainTx(address, tx)
      if (row) rows.push(row)
    }
    marker = result?.marker
    if (!marker || txs.length === 0) break
  }
  return rows
}

function toChainTx(address: string, tx: XrpTransaction): ChainTx | null {
  if (tx.meta?.TransactionResult && tx.meta.TransactionResult !== 'tesSUCCESS') return null
  const json = tx.tx_json ?? {}
  if (json.TransactionType !== 'Payment') return null
  const delivered = tx.meta?.delivered_amount ?? json.Amount
  if (delivered === undefined || delivered === 'unavailable') return null
  const parsed = parseAmount(delivered)
  if (!parsed || parsed.value === '0') return null

  const from = json.Account ?? ''
  const to = json.Destination ?? ''
  const isFrom = from === address
  const isTo = to === address
  const direction = isFrom && isTo ? 'self' : isTo ? 'in' : isFrom ? 'out' : null
  if (!direction) return null

  const at =
    tx.close_time_iso ??
    (json.date !== undefined ? new Date((json.date + RIPPLE_EPOCH) * 1000).toISOString() : '')

  return {
    chain: 'xrp',
    txid: tx.hash ?? '',
    at,
    from,
    to,
    asset: parsed.asset,
    amount: signedAmount(parsed.value, direction),
    direction,
  }
}

function parseAmount(amount: XrpAmount): { asset: string; value: string } | null {
  if (typeof amount === 'string') {
    return { asset: 'XRP', value: fromBaseUnits(amount, 6) }
  }
  if (!amount || typeof amount !== 'object' || !amount.value) return null
  const code = amount.currency && amount.currency !== 'XRP' ? amount.currency : 'XRP'
  return { asset: code, value: amount.value }
}
