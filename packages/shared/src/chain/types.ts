export const CHAINS = ['btc', 'ltc', 'eth', 'bnb', 'xrp', 'xlm'] as const

export type Chain = (typeof CHAINS)[number]

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
