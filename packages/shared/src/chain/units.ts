import { money } from '../money'
import type { ChainTxDirection } from './types'

export function fromBaseUnits(value: string, decimals: number): string {
  return money(value).div(money(10).pow(decimals)).toString()
}

export function signedAmount(absolute: string, direction: ChainTxDirection): string {
  if (direction === 'out') return money(absolute).negated().toString()
  return money(absolute).toString()
}

export function directionFromNet(net: string): ChainTxDirection {
  const amount = money(net)
  if (amount.isPositive()) return 'in'
  if (amount.isNegative()) return 'out'
  return 'self'
}

export function isoFromUnixSeconds(seconds: string | number): string {
  return new Date(Number(seconds) * 1000).toISOString()
}

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}
