import { chainTxExternalId, shortenAddress } from './commit'
import { ESPLORA_URLS, fetchEsploraTransactions } from './esplora'
import { getJson, indexerLog, sleep } from './http'
import { IndexerError, type ChainTx, type IndexerOptions } from './types'
import {
  deriveHdAddress,
  kindForExtendedKey,
  type AddressScript,
} from './xpub-key'

export const XPUB_GAP_LIMIT = 20
export const XPUB_MAX_INDEX = 2_000

export {
  assertWatchableKey,
  deriveHdAddress,
  isExtendedPrivateKey,
  isExtendedPublicKey,
  supportsHdKeys,
  type AddressScript,
} from './xpub-key'

export async function fetchExtendedKeyTransactions(
  chain: 'btc' | 'ltc',
  extendedKey: string,
  options: IndexerOptions = {},
): Promise<ChainTx[]> {
  const kind = kindForExtendedKey(extendedKey)
  if (!kind) throw new IndexerError('Not an HD extended public key.')
  const gap = options.gapLimit && options.gapLimit > 0 ? options.gapLimit : XPUB_GAP_LIMIT
  const delay = options.delayMs ?? 0
  indexerLog(options, `HD ${chain} ${kind.prefix} ${shortenAddress(extendedKey)} gap=${gap} delay=${delay}ms`)
  const script = await detectScript(chain, extendedKey, kind.script, kind.extraScripts, options, delay)
  indexerLog(options, `script ${script}`)
  const rows: ChainTx[] = []
  const seen = new Set<string>()
  let first = true
  let used = 0

  for (const change of [0, 1] as const) {
    const branch = change === 0 ? 'receive' : 'change'
    let unused = 0
    indexerLog(options, `walk ${branch}`)
    for (let index = 0; index < XPUB_MAX_INDEX && unused < gap; index += 1) {
      if (!first) await sleep(delay)
      first = false
      const address = deriveHdAddress(chain, extendedKey, script, change, index)
      const txCount = await fetchAddressTxCount(chain, address, options)
      if (txCount === 0) {
        unused += 1
        indexerLog(options, `${branch}/${index} ${shortenAddress(address)} unused ${unused}/${gap}`)
        continue
      }
      unused = 0
      used += 1
      indexerLog(options, `${branch}/${index} ${shortenAddress(address)} ${txCount} txs`)
      if (delay > 0) await sleep(delay)
      const txs = await fetchEsploraTransactions(chain, address, options)
      for (const tx of txs) {
        const id = chainTxExternalId(tx)
        if (seen.has(id)) continue
        seen.add(id)
        rows.push(tx)
      }
      indexerLog(options, `${branch}/${index} fetched ${txs.length} (total ${rows.length})`)
    }
  }
  indexerLog(options, `HD done ${rows.length} txs from ${used} used addresses`)
  return rows
}

async function detectScript(
  chain: 'btc' | 'ltc',
  extendedKey: string,
  defaultScript: AddressScript,
  extraScripts: AddressScript[],
  options: IndexerOptions,
  delay: number,
): Promise<AddressScript> {
  const defaultAddress = deriveHdAddress(chain, extendedKey, defaultScript, 0, 0)
  indexerLog(options, `probe ${defaultScript} 0/0 ${shortenAddress(defaultAddress)}`)
  const defaultCount = await fetchAddressTxCount(chain, defaultAddress, options)
  indexerLog(options, `probe ${defaultScript} 0/0 ${defaultCount} txs`)
  if (defaultCount > 0 || extraScripts.length === 0) return defaultScript
  let best: AddressScript = defaultScript
  let bestCount = defaultCount
  for (const script of extraScripts) {
    if (delay > 0) await sleep(delay)
    const address = deriveHdAddress(chain, extendedKey, script, 0, 0)
    indexerLog(options, `probe ${script} 0/0 ${shortenAddress(address)}`)
    const txCount = await fetchAddressTxCount(chain, address, options)
    indexerLog(options, `probe ${script} 0/0 ${txCount} txs`)
    if (txCount > bestCount) {
      best = script
      bestCount = txCount
    }
  }
  return bestCount > 0 ? best : defaultScript
}

async function fetchAddressTxCount(
  chain: 'btc' | 'ltc',
  address: string,
  options: IndexerOptions,
): Promise<number> {
  const base = options.baseUrl ?? ESPLORA_URLS[chain]
  const body = await getJson<{
    chain_stats?: { tx_count?: number }
    mempool_stats?: { tx_count?: number }
  }>(`${base}/address/${encodeURIComponent(address)}`, options)
  return (body.chain_stats?.tx_count ?? 0) + (body.mempool_stats?.tx_count ?? 0)
}
