import { fetchBnbTransactions, fetchEthTransactions } from './evm'
import { fetchEsploraTransactions } from './esplora'
import { resetIndexerPace } from './http'
import { IndexerError, isChain, type Chain, type ChainTx, type IndexerOptions } from './types'
import { fetchXlmTransactions } from './xlm'
import {
  assertWatchableKey,
  fetchExtendedKeyTransactions,
  isExtendedPublicKey,
  supportsHdKeys,
} from './xpub'
import { fetchXrpTransactions } from './xrp'

export {
  CHAINS,
  IndexerError,
  isChain,
  type Chain,
  type ChainTx,
  type FetchLike,
  type IndexerOptions,
} from './types'
export { ESPLORA_URLS, fetchEsploraTransactions } from './esplora'
export { ETH_BLOCKSCOUT_URL, ETHERSCAN_V2_URL, fetchBnbTransactions, fetchEthTransactions } from './evm'
export { XRPL_URL, fetchXrpTransactions } from './xrp'
export {
  BLOCKDAEMON_HORIZON_URL,
  STELLAR_HORIZON_URL,
  fetchXlmTransactions,
  resolveHorizon,
} from './xlm'
export {
  chainTxDescription,
  chainTxExternalId,
  commitChainTransactions,
  shortenAddress,
  toCreateTransactionInput,
  type ChainAddressSyncResult,
  type ChainSyncCommit,
} from './commit'
export {
  XPUB_GAP_LIMIT,
  assertWatchableKey,
  deriveHdAddress,
  fetchExtendedKeyTransactions,
  isExtendedPrivateKey,
  isExtendedPublicKey,
  supportsHdKeys,
  type AddressScript,
} from './xpub'

export interface FetchAddressTransactionsInput extends IndexerOptions {
  chain: Chain | string
  address: string
  blockdaemonApiKey?: string
}

export async function fetchAddressTransactions(
  input: FetchAddressTransactionsInput,
): Promise<ChainTx[]> {
  const address = input.address.trim()
  if (!address) throw new IndexerError('Address is required.')
  const chain = input.chain
  if (!isChain(chain)) {
    throw new IndexerError(`Unsupported chain "${chain}".`)
  }
  assertWatchableKey(address, chain)
  resetIndexerPace()
  input.onLog?.(`fetch ${chain} ${address}`)
  if (!input.fetch) input.onLog?.('pace 1.2s between requests, slower after 429')
  if (isExtendedPublicKey(address) && supportsHdKeys(chain)) {
    return fetchExtendedKeyTransactions(chain, address, input)
  }
  const options: IndexerOptions & { blockdaemonApiKey?: string } = {
    fetch: input.fetch,
    headers: input.headers,
    baseUrl: input.baseUrl,
    etherscanApiKey: input.etherscanApiKey,
    horizonUrl: input.horizonUrl,
    delayMs: input.delayMs,
    gapLimit: input.gapLimit,
    onLog: input.onLog,
    blockdaemonApiKey: input.blockdaemonApiKey,
  }
  switch (chain) {
    case 'btc':
    case 'ltc':
      return fetchEsploraTransactions(chain, address, options)
    case 'eth':
      return fetchEthTransactions(address, options)
    case 'bnb':
      return fetchBnbTransactions(address, options)
    case 'xrp':
      return fetchXrpTransactions(address, options)
    case 'xlm':
      return fetchXlmTransactions(address, options)
  }
}
