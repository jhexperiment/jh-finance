import { money } from '../money'
import { getJson, sleep } from './http'
import { IndexerError, type ChainTx, type IndexerOptions } from './types'
import {
  fromBaseUnits,
  isoFromUnixMillis,
  isoFromUnixSeconds,
  sameAddress,
  signedAmount,
} from './units'

export const ETH_BLOCKSCOUT_URL = 'https://eth.blockscout.com/api/v2'
export const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api'
export const BNB_BEACON_URL = 'https://explorer.bnbchain.org/api/v1'
export const BINPLORER_URL = 'https://api.binplorer.com'

const MAX_PAGES = 10_000
const ETHERSCAN_PAGE = 10_000
const BEACON_PAGE = 100
const BNB_BEACON_ADDRESS = /^(bnb|tbnb)1[0-9a-z]+$/i
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

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

interface BeaconTx {
  txHash?: string
  timeStamp?: number | string
  fromAddr?: string
  toAddr?: string
  value?: number | string
  txAsset?: string
  data?: string
  code?: number
}

interface BeaconTxPage {
  txNums?: number
  txArray?: BeaconTx[]
}

interface BinplorerTokenInfo {
  symbol?: string
  decimals?: string
}

interface BinplorerToken {
  tokenInfo?: BinplorerTokenInfo
  balance?: number | string
  rawBalance?: string
}

interface BinplorerAddressInfo {
  error?: { message?: string } | string
  ETH?: { balance?: number | string; rawBalance?: string }
  tokens?: BinplorerToken[]
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
  if (BNB_BEACON_ADDRESS.test(address.trim())) {
    const beacon = await fetchBnbBeaconTransactions(address, options)
    const bsc: ChainTx[] = []
    for (const evm of linkedEvmAddresses(beacon)) {
      bsc.push(...(await fetchBnbSmartChainPositions(evm, options)))
    }
    return [...beacon, ...bsc]
  }
  return fetchBnbSmartChain(address, options)
}

async function fetchBnbSmartChain(address: string, options: IndexerOptions): Promise<ChainTx[]> {
  const apiKey = options.etherscanApiKey ?? ''
  if (apiKey) {
    try {
      return await fetchBnbEtherscan(address, apiKey, options)
    } catch (error) {
      if (!isEtherscanPlanError(error)) throw error
      options.onLog?.('etherscan plan lacks BSC; using Binplorer balances')
    }
  }
  return fetchBnbSmartChainPositions(address, options)
}

async function fetchBnbEtherscan(
  address: string,
  apiKey: string,
  options: IndexerOptions,
): Promise<ChainTx[]> {
  const base = options.baseUrl ?? ETHERSCAN_V2_URL
  const native = await paginateEtherscan(base, apiKey, '56', 'txlist', address, options)
  const tokens = await paginateEtherscan(base, apiKey, '56', 'tokentx', address, options)
  const rows: ChainTx[] = []
  for (const tx of native) {
    const row = nativeFromEtherscan('bsc', address, tx)
    if (row) rows.push(row)
  }
  for (const tx of tokens) {
    const row = tokenFromEtherscan('bsc', address, tx)
    if (row) rows.push(row)
  }
  return rows
}

async function fetchBnbSmartChainPositions(
  address: string,
  options: IndexerOptions,
): Promise<ChainTx[]> {
  const url = `${BINPLORER_URL}/getAddressInfo/${encodeURIComponent(address)}?apiKey=freekey`
  const body = await getJson<BinplorerAddressInfo>(url, options)
  if (body.error) {
    const message = typeof body.error === 'string' ? body.error : body.error.message
    throw new IndexerError(message || 'Binplorer failed')
  }
  const rows: ChainTx[] = []
  const native = bscPosition(address, 'BNB', body.ETH?.rawBalance ?? body.ETH?.balance, 18)
  if (native) rows.push(native)
  for (const token of body.tokens ?? []) {
    const symbol = token.tokenInfo?.symbol?.trim()
    if (!symbol) continue
    const decimals = Number(token.tokenInfo?.decimals ?? 18)
    const row = bscPosition(
      address,
      symbol,
      token.rawBalance ?? token.balance,
      Number.isFinite(decimals) ? decimals : 18,
    )
    if (row) rows.push(row)
  }
  return rows
}

async function fetchBnbBeaconTransactions(
  address: string,
  options: IndexerOptions,
): Promise<ChainTx[]> {
  const rows: ChainTx[] = []
  for (const tx of await paginateBeacon(address, options)) {
    const row = fromBeaconTx(address, tx)
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
      throw new IndexerError(etherscanMessage(result))
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

async function paginateBeacon(address: string, options: IndexerOptions): Promise<BeaconTx[]> {
  const rows: BeaconTx[] = []
  const base = BNB_BEACON_URL
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) await sleep(options.delayMs ?? 0)
    const params = new URLSearchParams({
      address,
      page: String(page),
      rows: String(BEACON_PAGE),
    })
    const body = await getJson<BeaconTxPage>(`${base}/txs?${params.toString()}`, options)
    const items = body.txArray ?? []
    rows.push(...items)
    const total = body.txNums ?? rows.length
    if (items.length === 0 || page * BEACON_PAGE >= total) break
  }
  return rows
}

function nativeFromBlockscout(
  chain: 'eth' | 'bnb' | 'bsc',
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
  chain: 'eth' | 'bnb' | 'bsc',
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

function fromBeaconTx(address: string, tx: BeaconTx): ChainTx | null {
  if (tx.code && tx.code !== 0) return null
  const extra = parseBeaconData(tx.data)
  const from = tx.fromAddr ?? extra.from ?? ''
  const to = tx.toAddr ?? extra.to ?? ''
  const direction = directionFor(address, from, to)
  if (!direction) return null
  const amount = decimalAmount(extra.amount) ?? decimalAmount(tx.value)
  if (!amount) return null
  return {
    chain: 'bnb',
    txid: tx.txHash ?? '',
    at: tx.timeStamp ? isoFromUnixMillis(tx.timeStamp) : '',
    from,
    to,
    asset: tx.txAsset || extra.asset || 'BNB',
    amount: signedAmount(amount, direction),
    direction,
  }
}

function nativeFromEtherscan(chain: 'eth' | 'bnb' | 'bsc', address: string, tx: EtherscanTx): ChainTx | null {
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

function tokenFromEtherscan(chain: 'eth' | 'bnb' | 'bsc', address: string, tx: EtherscanTx): ChainTx | null {
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

function etherscanMessage(result: string): string {
  if (/free api access is not supported for this chain/i.test(result)) {
    return 'Etherscan free plans no longer cover BNB Smart Chain. Watch a Beacon address (bnb1…) or use an Etherscan key with BNB coverage.'
  }
  return result
}

function isEtherscanPlanError(error: unknown): boolean {
  return error instanceof IndexerError && /no longer cover BNB Smart Chain|free api access is not supported/i.test(error.message)
}

function linkedEvmAddresses(txs: ChainTx[]): string[] {
  const seen = new Set<string>()
  const rows: string[] = []
  for (const tx of txs) {
    for (const value of [tx.to, tx.from]) {
      if (!EVM_ADDRESS.test(value)) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(value)
    }
  }
  return rows
}

function bscPosition(
  address: string,
  asset: string,
  raw: number | string | undefined,
  decimals: number,
): ChainTx | null {
  if (raw === undefined || raw === '') return null
  const amount =
    typeof raw === 'string' && !raw.includes('.') ? fromBaseUnits(raw, decimals) : decimalAmount(raw)
  if (!amount || money(amount).isZero()) return null
  return {
    chain: 'bnb',
    txid: `bsc-balance:${address.toLowerCase()}:${asset}`,
    at: '',
    from: '',
    to: address,
    asset,
    amount: signedAmount(amount, 'in'),
    direction: 'in',
  }
}

function parseBeaconData(raw?: string): { from?: string; to?: string; amount?: string; asset?: string } {
  if (!raw) return {}
  try {
    const data = JSON.parse(raw) as {
      from?: string
      toAddress?: string
      fromAddress?: string
      amount?: { amount?: number | string; denom?: string } | number | string
    }
    const rawAmount = typeof data.amount === 'object' && data.amount ? data.amount.amount : data.amount
    const denom = typeof data.amount === 'object' && data.amount ? data.amount.denom : undefined
    return {
      from: data.from ?? data.fromAddress,
      to: data.toAddress,
      amount: rawAmount === undefined ? undefined : fromBaseUnits(String(rawAmount), 8),
      asset: denom,
    }
  } catch {
    return {}
  }
}

function decimalAmount(value: number | string | undefined): string | null {
  if (value === undefined || value === '') return null
  try {
    const amount = money(String(value))
    if (!amount.isFinite() || amount.isZero()) return null
    return amount.abs().toString()
  } catch {
    return null
  }
}

function toQuery(params: Record<string, string | number | boolean | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    search.set(key, String(value))
  }
  return search.toString()
}
