export const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  LTC: 'litecoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  XRP: 'ripple',
  XLM: 'stellar',
  WETH: 'weth',
  WBTC: 'wrapped-bitcoin',
  STETH: 'staked-ether',
  WEETH: 'wrapped-eeth',
  CBETH: 'coinbase-wrapped-staked-eth',
  RETH: 'rocket-pool-eth',
  SOL: 'solana',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  ATOM: 'cosmos',
  DOT: 'polkadot',
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  PEPE: 'pepe',
  SHIB: 'shiba-inu',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
}

export const STABLECOIN_USD: Record<string, string> = {
  USDC: '1',
  USDT: '1',
  DAI: '1',
  BUSD: '1',
  TUSD: '1',
  USDP: '1',
  FDUSD: '1',
  PYUSD: '1',
  GUSD: '1',
  FRAX: '1',
  LUSD: '1',
  USDD: '1',
  USDE: '1',
  RLUSD: '1',
}

export const COIN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  LTC: 'Litecoin',
  ETH: 'Ethereum',
  BNB: 'BNB',
  XRP: 'XRP',
  XLM: 'Stellar',
  USDC: 'USD Coin',
  USDT: 'Tether',
  DAI: 'Dai',
  WETH: 'Wrapped Ether',
  WBTC: 'Wrapped Bitcoin',
}

export function quoteTicker(asset: string | null | undefined): string {
  const raw = asset?.trim() ?? ''
  if (!raw) return ''
  const code = raw.includes('-') ? raw.slice(0, raw.indexOf('-')) : raw
  return code.trim().toUpperCase()
}

export function geckoIdFor(ticker: string): string | undefined {
  return COINGECKO_IDS[quoteTicker(ticker)]
}

export function stableUsdFor(ticker: string): string | undefined {
  return STABLECOIN_USD[quoteTicker(ticker)]
}

export function coinNameFor(ticker: string, fallback = ticker): string {
  const key = quoteTicker(ticker)
  return COIN_NAMES[key] ?? fallback
}

export function isKnownCryptoTicker(ticker: string): boolean {
  const key = quoteTicker(ticker)
  return Boolean(COINGECKO_IDS[key] || STABLECOIN_USD[key])
}
