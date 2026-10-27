import { money } from '../money'
import { getJson, indexerLog, sleep } from './http'
import type { Chain, ChainTx, IndexerOptions } from './types'
import { directionFromNet, fromBaseUnits, signedAmount } from './units'

export const ESPLORA_URLS = {
  btc: 'https://mempool.space/api',
  ltc: 'https://litecoinspace.org/api',
} as const

interface EsploraPrevout {
  scriptpubkey_address?: string
  value?: number
}

interface EsploraVin {
  prevout?: EsploraPrevout | null
}

interface EsploraVout {
  scriptpubkey_address?: string
  value?: number
}

interface EsploraTx {
  txid: string
  vin: EsploraVin[]
  vout: EsploraVout[]
  status?: { confirmed?: boolean; block_time?: number }
}

const PAGE_SIZE = 25
const MAX_PAGES = 10_000

export async function fetchEsploraTransactions(
  chain: 'btc' | 'ltc',
  address: string,
  options: IndexerOptions = {},
): Promise<ChainTx[]> {
  const base = options.baseUrl ?? ESPLORA_URLS[chain]
  const rows: ChainTx[] = []
  let lastTxid: string | undefined

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) await sleep(options.delayMs ?? 0)
    const path = lastTxid
      ? `/address/${encodeURIComponent(address)}/txs/chain/${lastTxid}`
      : `/address/${encodeURIComponent(address)}/txs/chain`
    const txs = await getJson<EsploraTx[]>(`${base}${path}`, options)
    if (!Array.isArray(txs) || txs.length === 0) {
      indexerLog(options, `txs ${address} page ${page + 1} empty`)
      break
    }

    for (const tx of txs) {
      const row = toChainTx(chain, address, tx)
      if (row) rows.push(row)
    }
    indexerLog(options, `txs page ${page + 1} +${txs.length} (stored ${rows.length})`)

    const next = txs[txs.length - 1]?.txid
    if (!next || next === lastTxid || txs.length < PAGE_SIZE) break
    lastTxid = next
  }

  return rows
}

function toChainTx(chain: Chain, address: string, tx: EsploraTx): ChainTx | null {
  if (tx.status && tx.status.confirmed === false) return null
  const at = tx.status?.block_time ? new Date(tx.status.block_time * 1000).toISOString() : ''
  if (!at) return null

  let received = money(0)
  let sent = money(0)
  const othersIn: string[] = []
  const othersOut: string[] = []

  for (const vin of tx.vin) {
    const prev = vin.prevout
    if (!prev) continue
    const source = prev.scriptpubkey_address ?? ''
    const value = money(prev.value ?? 0)
    if (source === address) sent = sent.plus(value)
    else if (source) othersIn.push(source)
  }
  for (const vout of tx.vout) {
    const dest = vout.scriptpubkey_address ?? ''
    const value = money(vout.value ?? 0)
    if (dest === address) received = received.plus(value)
    else if (dest) othersOut.push(dest)
  }

  const net = received.minus(sent)
  if (net.isZero() && sent.isZero() && received.isZero()) return null
  const direction = directionFromNet(net.toString())
  const amount = signedAmount(fromBaseUnits(net.abs().toString(), 8), direction)
  const asset = chain === 'btc' ? 'BTC' : 'LTC'
  const from = direction === 'in' ? othersIn[0] ?? '' : address
  const to = direction === 'out' ? othersOut[0] ?? '' : address

  return { chain, txid: tx.txid, at, from, to, asset, amount, direction }
}
