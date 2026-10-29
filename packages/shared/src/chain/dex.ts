import type { Holding } from '../types'
import { CHAIN_LABEL, isChain, type Chain } from './types'

export interface DexVenue {
  id: string
  name: string
  url: string
  chains: Chain[]
  summary: string
}

export interface DexAsset {
  chain: Chain
  chainLabel: string
  symbol: string
  quantity: string
}

export interface DexVenueMatch {
  venue: DexVenue
  networks: string[]
  assets: DexAsset[]
}

export const DEX_VENUES: DexVenue[] = [
  {
    id: 'pancakeswap',
    name: 'PancakeSwap',
    url: 'https://pancakeswap.finance/swap',
    chains: ['bsc'],
    summary: 'Main BNB Smart Chain AMM.',
  },
  {
    id: 'thena',
    name: 'THENA',
    url: 'https://thena.fi',
    chains: ['bsc'],
    summary: 'BNB Smart Chain concentrated and Solidly-style pools.',
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    url: 'https://app.uniswap.org/swap',
    chains: ['eth', 'bsc'],
    summary: 'AMM on Ethereum and BNB Chain.',
  },
  {
    id: '1inch',
    name: '1inch',
    url: 'https://app.1inch.io',
    chains: ['eth', 'bsc'],
    summary: 'Aggregator across Ethereum and BNB Smart Chain pools.',
  },
  {
    id: 'sologenic',
    name: 'Sologenic',
    url: 'https://sologenic.org/trade',
    chains: ['xrp'],
    summary: 'XRP Ledger native DEX.',
  },
  {
    id: 'stellarterm',
    name: 'StellarTerm',
    url: 'https://stellarterm.com',
    chains: ['xlm'],
    summary: 'Stellar DEX (native order book).',
  },
]

function isPresent(quantity?: string): quantity is string {
  return Boolean(quantity && quantity !== '0')
}

export function dexAssetsFromHoldings(holdings: Holding[]): DexAsset[] {
  const assets: DexAsset[] = []
  for (const holding of holdings) {
    if (!holding.chain || !isChain(holding.chain)) continue
    const chain = holding.chain
    const chainLabel = CHAIN_LABEL[chain]
    const quantity = holding.quantity
    if (holding.symbol && isPresent(quantity)) {
      assets.push({
        chain,
        chainLabel,
        symbol: holding.symbol,
        quantity,
      })
    }
    for (const token of holding.tokens ?? []) {
      if (!token.symbol || !isPresent(token.quantity)) continue
      assets.push({
        chain,
        chainLabel,
        symbol: token.symbol,
        quantity: token.quantity,
      })
    }
  }
  return assets
}

export function dexMatchesForHoldings(holdings: Holding[]): DexVenueMatch[] {
  const assets = dexAssetsFromHoldings(holdings)
  const matches: DexVenueMatch[] = []
  for (const venue of DEX_VENUES) {
    const matched = assets.filter((asset) => venue.chains.includes(asset.chain))
    if (matched.length === 0) continue
    const networks = [...new Set(matched.map((asset) => asset.chainLabel))]
    matches.push({ venue, networks, assets: matched })
  }
  return matches
}

export function dexUnsupportedHoldings(holdings: Holding[]): DexAsset[] {
  const covered = new Set(DEX_VENUES.flatMap((venue) => venue.chains))
  return dexAssetsFromHoldings(holdings).filter((asset) => !covered.has(asset.chain))
}
