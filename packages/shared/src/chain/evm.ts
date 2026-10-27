import { getJson, sleep } from './http'
import { IndexerError, type ChainTx, type IndexerOptions } from './types'
import { fromBaseUnits, isoFromUnixSeconds, sameAddress, signedAmount } from './units'

export const ETH_BLOCKSCOUT_URL = 'https://eth.blockscout.com/api/v2'
export const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api'

const MAX_PAGES = 10_000
const ETHERSCAN_PAGE = 10_000

interface BlockscoutAddress {
  hash?: string
}

interface BlockscoutTx {
  hash?: string
  timestamp?: string
  value?: string
  result?: string
  from?: BlockscoutAddress
  to?: BlockscoutAddress | null
}

interface BlockscoutToken {
  symbol?: string
  decimals?: string
  type?: string
}

interface BlockscoutTokenTotal {
  value?: string
  decimals?: string
}

interface BlockscoutTokenTransfer {
  transaction_hash?: string
  timestamp?: string
  from?: BlockscoutAddress
  to?: BlockscoutAddress | null
  token?: BlockscoutToken
  token_type?: string
  total?: BlockscoutTokenTotal
}

interface BlockscoutPage<T> {
  items?: T[]
  next_page_params?: Record<string, string | number | boolean | null> | null
}

interface EtherscanTx {
  hash?: string
  timeStamp?: string
  from?: string
  to?: string
  value?: string
  isError?: string
  txreceipt_status?: string
  contractAddress?: string
  tokenSymbol?: string
  tokenDecimal?: string
  blockNumber?: string
}

interface EtherscanResponse {
  status?: string
  message?: string
  result?: EtherscanTx[] | string
}

export async function fetchEthTransactions(
  address: string,
  options: IndexerOptions = {},
): Promise<ChainTx[]> {
  const base = options.baseUrl ?? ETH_BLOCKSCOUT_URL
  const native = await paginateBlockscout<BlockscoutTx>(
    `${base}/addresses/${encodeURIComponent(address)}/transactions`,
    options,
  )
  const tokens = await paginateBlockscout<BlockscoutTokenTransfer>(
    `${base}/addresses/${encodeURIComponent(address)}/token-transfers`,
    options,
  )

  const rows: ChainTx[] = []
  for (const tx of native) {
    const row = nativeFromBlockscout('eth', address, tx)
    if (row) rows.push(row)
  }
  for (const tx of tokens) {
    const row = tokenFromBlockscout('eth', address, tx)
    if (row) rows.push(row)
  }
  return rows
}

export async function fetchBnbTransactions(
  address: string,
  options: IndexerOptions = {},
): Promise<ChainTx[]> {
  const apiKey = options.etherscanApiKey ?? ''
  if (!apiKey) {
    throw new IndexerError(
      'BNB history needs an Etherscan API key (ETHERSCAN_API_KEY). Free keys work for chainid=56.',
    )
  }
  const base = options.baseUrl ?? ETHERSCAN_V2_URL
  const native = await paginateEtherscan(base, apiKey, '56', 'txlist', address, options)
  const tokens = await paginateEtherscan(base, apiKey, '56', 'tokentx', address, options)
  const rows: ChainTx[] = []
  for (const tx of native) {
    const row = nativeFromEtherscan('bnb', address, tx)
    if (row) rows.push(row)
  }
  for (const tx of tokens) {
    const row = tokenFromEtherscan('bnb', address, tx)
    if (row) rows.push(row)
  }
  return rows
}

async function paginateBlockscout<T>(url: string, options: IndexerOptions): Promise<T[]> {
  const rows: T[] = []
  let next: Record<string, string | number | boolean | null> | null | undefined
  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) await sleep(options.delayMs ?? 0)
    const query = next ? `?${toQuery(next)}` : ''
    const body = await getJson<BlockscoutPage<T>>(`${url}${query}`, options)
    const items = body.items ?? []
    rows.push(...items)
    next = body.next_page_params
    if (!next || items.length === 0) break
  }
  return rows
}

async function paginateEtherscan(
  base: string,
  apiKey: string,
  chainId: string,
  action: 'txlist' | 'tokentx',
  address: string,
  options: IndexerOptions,
): Promise<EtherscanTx[]> {
  const rows: EtherscanTx[] = []
  let startblock = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) await sleep(options.delayMs ?? 0)
    const params = new URLSearchParams({
      chainid: chainId,
      module: 'account',
      action,
      address,
      startblock: String(startblock),
      endblock: '99999999',
      page: '1',
      offset: String(ETHERSCAN_PAGE),
      sort: 'asc',
      apikey: apiKey,
    })
    const body = await getJson<EtherscanResponse>(`${base}?${params.toString()}`, options)
    const result = body.result
    if (typeof result === 'string') {
      if (/no transactions found/i.test(result) || body.message === 'No transactions found') break
      throw new IndexerError(result)
    }
    if (body.status === '0' && (!result || result.length === 0)) break
    if (!Array.isArray(result) || result.length === 0) break
    const seen = new Set(rows.map(etherscanKey))
    for (const tx of result) {
      const key = etherscanKey(tx)
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(tx)
    }
    if (result.length < ETHERSCAN_PAGE) break
    const lastBlock = Number(result[result.length - 1]?.blockNumber ?? startblock)
    if (!Number.isFinite(lastBlock) || lastBlock <= startblock) break
    startblock = lastBlock
  }
  return rows
}

function nativeFromBlockscout(
  chain: 'eth' | 'bnb',
  address: string,
  tx: BlockscoutTx,
): ChainTx | null {
  if (tx.result && tx.result !== 'success') return null
  const value = tx.value ?? '0'
  if (value === '0') return null
  const from = tx.from?.hash ?? ''
  const to = tx.to?.hash ?? ''
  const direction = directionFor(address, from, to)
  if (!direction) return null
  return {
    chain,
    txid: tx.hash ?? '',
    at: tx.timestamp ?? '',
    from,
    to,
    asset: chain === 'eth' ? 'ETH' : 'BNB',
    amount: signedAmount(fromBaseUnits(value, 18), direction),
    direction,
  }
}

function tokenFromBlockscout(
  chain: 'eth' | 'bnb',
  address: string,
  tx: BlockscoutTokenTransfer,
): ChainTx | null {
  const tokenType = tx.token_type ?? tx.token?.type ?? ''
  if (tokenType && tokenType !== 'ERC-20') return null
  const from = tx.from?.hash ?? ''
  const to = tx.to?.hash ?? ''
  const direction = directionFor(address, from, to)
  if (!direction) return null
  const decimals = Number(tx.total?.decimals ?? tx.token?.decimals ?? 18)
  const value = tx.total?.value ?? '0'
  if (value === '0') return null
  return {
    chain,
    txid: tx.transaction_hash ?? '',
    at: tx.timestamp ?? '',
    from,
    to,
    asset: tx.token?.symbol || 'TOKEN',
    amount: signedAmount(fromBaseUnits(value, Number.isFinite(decimals) ? decimals : 18), direction),
    direction,
  }
}

function nativeFromEtherscan(chain: 'eth' | 'bnb', address: string, tx: EtherscanTx): ChainTx | null {
  if (tx.isError === '1' || tx.txreceipt_status === '0') return null
  const value = tx.value ?? '0'
  if (value === '0') return null
  const from = tx.from ?? ''
  const to = tx.to ?? ''
  const direction = directionFor(address, from, to)
  if (!direction) return null
  return {
    chain,
    txid: tx.hash ?? '',
    at: tx.timeStamp ? isoFromUnixSeconds(tx.timeStamp) : '',
    from,
    to,
    asset: chain === 'eth' ? 'ETH' : 'BNB',
    amount: signedAmount(fromBaseUnits(value, 18), direction),
    direction,
  }
}

function tokenFromEtherscan(chain: 'eth' | 'bnb', address: string, tx: EtherscanTx): ChainTx | null {
  const from = tx.from ?? ''
  const to = tx.to ?? ''
  const direction = directionFor(address, from, to)
  if (!direction) return null
  const decimals = Number(tx.tokenDecimal || 18)
  const value = tx.value ?? '0'
  if (value === '0') return null
  return {
    chain,
    txid: tx.hash ?? '',
    at: tx.timeStamp ? isoFromUnixSeconds(tx.timeStamp) : '',
    from,
    to,
    asset: tx.tokenSymbol || 'TOKEN',
    amount: signedAmount(fromBaseUnits(value, Number.isFinite(decimals) ? decimals : 18), direction),
    direction,
  }
}

function directionFor(address: string, from: string, to: string): ChainTx['direction'] | null {
  const isFrom = sameAddress(from, address)
  const isTo = sameAddress(to, address)
  if (isFrom && isTo) return 'self'
  if (isTo) return 'in'
  if (isFrom) return 'out'
  return null
}

function etherscanKey(tx: EtherscanTx): string {
  return [tx.hash, tx.from, tx.to, tx.value, tx.tokenSymbol, tx.contractAddress].join(':')
}

function toQuery(params: Record<string, string | number | boolean | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    search.set(key, String(value))
  }
  return search.toString()
}
