import { money } from '../money'
import { getJson, indexerLog, sleep } from './http'
import type { Chain, ChainTx, IndexerOptions } from './types'
import { directionFromNet, fromBaseUnits, signedAmount } from './units'

export const BLOCKBOOK_LTC_URL = 'https://blockbook.ltc.zelcore.io/api/v2'

interface BlockbookVin {
  addresses?: string[]
  value?: string
}

interface BlockbookVout {
  addresses?: string[]
  value?: string
}

interface BlockbookTx {
  txid: string
  blockTime?: number
  confirmations?: number
  vin?: BlockbookVin[]
  vout?: BlockbookVout[]
}

interface BlockbookAddress {
  txs?: number
  page?: number
  totalPages?: number
  transactions?: BlockbookTx[]
}

const PAGE_SIZE = 50
const MAX_PAGES = 10_000

export async function fetchBlockbookTransactions(
  chain: 'ltc',
  address: string,
  options: IndexerOptions = {},
): Promise<ChainTx[]> {
  const base = options.baseUrl ?? BLOCKBOOK_LTC_URL
  const rows: ChainTx[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= MAX_PAGES) {
    if (page > 1) await sleep(options.delayMs ?? 0)
    const body = await getJson<BlockbookAddress>(
      `${base}/address/${encodeURIComponent(address)}?details=txs&pageSize=${PAGE_SIZE}&page=${page}`,
      options,
    )
    totalPages = Math.max(1, body.totalPages ?? page)
    for (const tx of body.transactions ?? []) {
      const row = toChainTx(chain, address, tx)
      if (row) rows.push(row)
    }
    indexerLog(
      options,
      `blockbook ${address} page ${page}/${totalPages} +${body.transactions?.length ?? 0} (stored ${rows.length})`,
    )
    if (!body.transactions?.length) break
    page += 1
  }

  return rows
}

export async function fetchBlockbookTxCount(
  address: string,
  options: IndexerOptions = {},
): Promise<number> {
  const base = options.baseUrl ?? BLOCKBOOK_LTC_URL
  const body = await getJson<BlockbookAddress>(
    `${base}/address/${encodeURIComponent(address)}?details=basic`,
    options,
  )
  return body.txs ?? 0
}

function toChainTx(chain: Chain, address: string, tx: BlockbookTx): ChainTx | null {
  if ((tx.confirmations ?? 0) === 0) return null
  const at = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : ''
  if (!at) return null

  let received = money(0)
  let sent = money(0)
  const othersIn: string[] = []
  const othersOut: string[] = []

  for (const vin of tx.vin ?? []) {
    const source = vin.addresses?.[0] ?? ''
    const value = money(vin.value ?? 0)
    if (source === address) sent = sent.plus(value)
    else if (source) othersIn.push(source)
  }
  for (const vout of tx.vout ?? []) {
    const dest = vout.addresses?.[0] ?? ''
    const value = money(vout.value ?? 0)
    if (dest === address) received = received.plus(value)
    else if (dest) othersOut.push(dest)
  }

  const net = received.minus(sent)
  if (net.isZero() && sent.isZero() && received.isZero()) return null
  const direction = directionFromNet(net.toString())
  const amount = signedAmount(fromBaseUnits(net.abs().toString(), 8), direction)
  return {
    chain,
    txid: tx.txid,
    at,
    from: direction === 'in' ? othersIn[0] ?? '' : address,
    to: direction === 'out' ? othersOut[0] ?? '' : address,
    asset: 'LTC',
    amount,
    direction,
  }
}
