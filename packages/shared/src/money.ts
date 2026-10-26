import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type MoneyInput = Decimal.Value

export function money(value: MoneyInput): Decimal {
  return new Decimal(value)
}

export function add(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).plus(b)
}

export function sub(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).minus(b)
}

export function mul(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).times(b)
}

export function div(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).div(b)
}

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(value), money(0))
}

export function formatUsd(
  value: MoneyInput,
  options: { sign?: 'auto' | 'always' | 'never'; digits?: number } = {},
): string {
  const amount = money(value)
  const digits = options.digits ?? 2
  const absolute = amount.abs().toFixed(digits)
  const [whole, fraction] = absolute.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = fraction === undefined ? grouped : `${grouped}.${fraction}`
  const signMode = options.sign ?? 'auto'
  if (signMode === 'never') {
    return `$${body}`
  }
  if (amount.isNegative()) {
    return `-$${body}`
  }
  if (signMode === 'always' && !amount.isZero()) {
    return `+$${body}`
  }
  return `$${body}`
}

export function formatPct(
  value: MoneyInput,
  options: { sign?: boolean; digits?: number } = {},
): string {
  const amount = money(value)
  const digits = options.digits ?? 1
  const body = `${amount.abs().toFixed(digits)}%`
  if (options.sign === false) {
    return body
  }
  if (amount.isNegative()) {
    return `-${body}`
  }
  if (amount.isZero()) {
    return body
  }
  return `+${body}`
}

export { Decimal }
