import { HDKey } from '@scure/bip32'
import { NETWORK, p2pkh, p2sh, p2tr, p2wpkh } from '@scure/btc-signer'
import { IndexerError, type Chain } from './types'

export type AddressScript = 'p2pkh' | 'p2wpkh-p2sh' | 'p2wpkh' | 'p2tr'

export interface ExtendedKind {
  prefix: string
  versions: { public: number; private: number }
  script: AddressScript
  extraScripts: AddressScript[]
}

export const EXTENDED_KINDS: ExtendedKind[] = [
  { prefix: 'xpub', versions: { public: 0x0488b21e, private: 0x0488ade4 }, script: 'p2pkh', extraScripts: ['p2wpkh', 'p2wpkh-p2sh'] },
  { prefix: 'ypub', versions: { public: 0x049d7cb2, private: 0x049d7878 }, script: 'p2wpkh-p2sh', extraScripts: [] },
  { prefix: 'zpub', versions: { public: 0x04b24746, private: 0x04b2430c }, script: 'p2wpkh', extraScripts: ['p2tr'] },
  { prefix: 'vpub', versions: { public: 0x045f1cf6, private: 0x045f18bc }, script: 'p2tr', extraScripts: ['p2wpkh'] },
  { prefix: 'Ltub', versions: { public: 0x019da462, private: 0x019d9cfe }, script: 'p2pkh', extraScripts: ['p2wpkh'] },
  { prefix: 'Mtub', versions: { public: 0x01b26ef6, private: 0x01b26792 }, script: 'p2wpkh-p2sh', extraScripts: [] },
]

const LTC_NETWORK: typeof NETWORK = {
  bech32: 'ltc',
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0,
}

const PRIVATE_KEY = /^(xprv|yprv|zprv|vprv|Yprv|Zprv|tprv|uprv|Ltpv|Mtpv)/

export function isExtendedPrivateKey(value: string): boolean {
  return PRIVATE_KEY.test(value.trim())
}

export function kindForExtendedKey(value: string): ExtendedKind | undefined {
  return EXTENDED_KINDS.find((kind) => value.startsWith(kind.prefix))
}

export function isExtendedPublicKey(value: string): boolean {
  return Boolean(kindForExtendedKey(value.trim()))
}

export function supportsHdKeys(chain: string): chain is 'btc' | 'ltc' {
  return chain === 'btc' || chain === 'ltc'
}

export function assertWatchableKey(value: string, chain?: Chain | string): void {
  if (isExtendedPrivateKey(value)) {
    throw new IndexerError('Do not paste an extended private key (xprv/zprv). Use the xpub/zpub.')
  }
  if (isExtendedPublicKey(value) && chain && !supportsHdKeys(chain)) {
    throw new IndexerError('HD xpub/zpub walking is only for Bitcoin and Litecoin.')
  }
}

export function deriveHdAddress(
  chain: 'btc' | 'ltc',
  extendedKey: string,
  script: AddressScript,
  change: 0 | 1,
  index: number,
): string {
  const kind = kindForExtendedKey(extendedKey)
  if (!kind) throw new IndexerError('Not an HD extended public key.')
  const node = HDKey.fromExtendedKey(extendedKey, kind.versions).derive(`m/${change}/${index}`)
  const pub = node.publicKey
  if (!pub) throw new IndexerError('Could not derive a public key from that xpub.')
  const network = chain === 'ltc' ? LTC_NETWORK : NETWORK
  const address =
    script === 'p2pkh'
      ? p2pkh(pub, network).address
      : script === 'p2wpkh'
        ? p2wpkh(pub, network).address
        : script === 'p2wpkh-p2sh'
          ? p2sh(p2wpkh(pub, network), network).address
          : p2tr(pub.slice(1), undefined, network).address
  if (!address) throw new IndexerError('Could not encode a derived address.')
  return address
}
