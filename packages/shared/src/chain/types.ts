export const CHAINS = ['btc', 'ltc', 'eth', 'bnb', 'bsc', 'xrp', 'xlm'] as const

export type Chain = (typeof CHAINS)[number]

export const NATIVE_TICKER: Record<Chain, string> = {
  btc: 'BTC',
  ltc: 'LTC',
  eth: 'ETH',
  bnb: 'BNB',
  bsc: 'BNB',
  xrp: 'XRP',
  xlm: 'XLM',
}

export const CHAIN_LABEL: Record<Chain, string> = {
  btc: 'Bitcoin',
  ltc: 'Litecoin',
  eth: 'Ethereum',
  bnb: 'BNB Beacon Chain',
  bsc: 'BNB Smart Chain',
  xrp: 'XRP',
  xlm: 'Stellar',
}

export const CHAIN_PLACEHOLDER: Record<Chain, string> = {
  btc: 'bc1q…, xpub…, or zpub…',
  ltc: 'ltc1… or Ltub…',
  eth: '0x…',
  bnb: 'bnb1…',
  bsc: '0x…',
  xrp: 'r…',
  xlm: 'G…',
}

export type FetchLike = typeof fetch

export type ChainTxDirection = 'in' | 'out' | 'self'

export interface ChainTx {
  chain: Chain
  txid: string
  at: string
  from: string
  to: string
  asset: string
  amount: string
  direction: ChainTxDirection
}

export interface IndexerOptions {
  fetch?: FetchLike
  headers?: Record<string, string>
  baseUrl?: string
  etherscanApiKey?: string
  horizonUrl?: string
  delayMs?: number
  gapLimit?: number
  onLog?: (line: string) => void
}

export class IndexerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'IndexerError'
  }
}

export function isChain(value: string): value is Chain {
  return (CHAINS as readonly string[]).includes(value)
}
