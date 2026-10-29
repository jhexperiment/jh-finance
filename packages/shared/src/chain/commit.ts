import { money } from '../money'
import type { CreateTransactionInput, LedgerSnapshot, LedgerTransaction } from '../ledger'
import { applyCreateTransaction, applyTouchChainAddress } from '../ledger'
import type { ChainTx } from './types'

export interface ChainSyncCommit {
  imported: LedgerTransaction[]
  importedCount: number
  skippedCount: number
  fetchedCount: number
}

export interface ChainAddressSyncResult {
  addressId: string
  chain: string
  address: string
  fetchedCount: number
  importedCount: number
  skippedCount: number
}

export function chainTxExternalId(tx: ChainTx): string {
  if (tx.txid.startsWith('bsc-balance:')) return `${tx.chain}:${tx.txid}`
  return `${tx.chain}:${tx.txid}:${tx.asset}:${tx.from}:${tx.to}:${tx.amount}`
}

export function shortenAddress(value: string): string {
  const address = value.trim()
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function chainTxDescription(tx: ChainTx): string {
  const qty = money(tx.amount).abs().toString()
  const peer = tx.direction === 'out' ? tx.to : tx.from
  const shortPeer = shortenAddress(peer)
  const network = tx.chain === 'bsc' ? 'BNB Smart Chain' : tx.chain === 'bnb' ? 'BNB Beacon Chain' : ''
  const onNetwork = network ? ` on ${network}` : ''
  if (tx.direction === 'self') return `${qty} ${tx.asset} self-transfer${onNetwork}`
  if (tx.direction === 'in') {
    return shortPeer
      ? `Received ${qty} ${tx.asset}${onNetwork} from ${shortPeer}`
      : `Received ${qty} ${tx.asset}${onNetwork}`
  }
  return shortPeer
    ? `Sent ${qty} ${tx.asset}${onNetwork} to ${shortPeer}`
    : `Sent ${qty} ${tx.asset}${onNetwork}`
}

export function toCreateTransactionInput(accountId: string, tx: ChainTx): CreateTransactionInput {
  return {
    accountId,
    postedAt: tx.at || undefined,
    description: chainTxDescription(tx),
    amount: tx.amount,
    asset: tx.asset,
    externalId: chainTxExternalId(tx),
    category: tx.asset,
    status: 'Posted',
  }
}

export function commitChainTransactions(
  snapshot: LedgerSnapshot,
  accountId: string,
  addressId: string,
  txs: ChainTx[],
): ChainSyncCommit {
  const existing = new Set(
    snapshot.transactions
      .filter((row) => row.accountId === accountId && row.externalId)
      .map((row) => row.externalId as string),
  )
  const imported: LedgerTransaction[] = []
  let skippedCount = 0
  for (const tx of txs) {
    const input = toCreateTransactionInput(accountId, tx)
    if (!input.externalId || existing.has(input.externalId)) {
      skippedCount += 1
      continue
    }
    existing.add(input.externalId)
    imported.push(applyCreateTransaction(snapshot, input))
  }
  const watched = snapshot.chainAddresses.find((row) => row.id === addressId)
  if (watched) applyTouchChainAddress(watched)
  return {
    imported,
    importedCount: imported.length,
    skippedCount,
    fetchedCount: txs.length,
  }
}
