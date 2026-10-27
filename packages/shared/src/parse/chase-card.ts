import { money } from '../money'

export interface ParsedCardTransaction {
  postedAt: string
  description: string
  amount: string
  category?: string
}

export type CardParser = 'chase-card' | 'american-express-card' | 'citi-card'

export interface ParsedCardStatement {
  parser: CardParser
  name: string
  mask: string
  newBalance: string
  statementDate: string | null
  periodStart: string | null
  periodEnd: string | null
  creditLimit: string | null
  transactions: ParsedCardTransaction[]
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const TXN_LINE =
  /^(\d{2}\/\d{2})\s+(.+?)\s+([-+]?\$?[0-9,]*(?:\.\d{1,2}))$/
const AMOUNT_ONLY = /^[-+]?\$?[0-9,]*(?:\.\d{1,2})$/

export function parseChaseCreditCard(text: string): ParsedCardStatement {
  const normalized = text.replace(/\r/g, '\n').replace(/\u00a0/g, ' ')
  if (!isChaseCardStatement(normalized)) {
    throw new ParseError("Couldn't read this as a Chase credit-card statement.")
  }

  const mask = firstMatch(normalized, /Account\s+numbers?:\s+(?:X{4}\s+){3}(\d{4})/i)
  if (!mask) {
    throw new ParseError("Chase statement is missing a masked account number.")
  }

  const newBalanceRaw =
    firstMatch(normalized, /New Balance\s+\$([0-9,]+\.\d{2})/) ??
    firstMatch(normalized, /New Balance[\s\S]{0,40}?\$([0-9,]+\.\d{2})/)
  if (!newBalanceRaw) {
    throw new ParseError('Chase statement is missing a new balance.')
  }

  const period = normalized.match(
    /Opening\/Closing Date\s+(\d{2}\/\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2}\/\d{2})/,
  )
  const statementDate = firstMatch(normalized, /Statement Date:\s+(\d{2}\/\d{2}\/\d{2})/)
  const periodEnd = parseShortDate(period?.[2] ?? statementDate)
  const periodStart = parseShortDate(period?.[1])
  const statement = parseShortDate(statementDate)

  const transactions: ParsedCardTransaction[] = []
  const seen = new Set<string>()
  for (const line of transactionLines(normalized)) {
    if (/^order number\b/i.test(line)) continue
    const match = line.match(TXN_LINE)
    if (!match) continue
    const description = cleanDescription(match[2])
    if (!description) continue
    const statementAmount = parseStatementAmount(match[3])
    const postedAt = isoFromMonthDay(match[1], periodEnd ?? statement ?? new Date())
    const amount = money(statementAmount).neg().toFixed(2)
    const fingerprint = `${postedAt.slice(0, 10)}|${amount}|${description.toLowerCase()}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    transactions.push({
      postedAt,
      description,
      amount,
      category: categoryFor(description),
    })
  }

  if (transactions.length === 0) {
    throw new ParseError("Chase statement didn't contain any transactions we could read.")
  }

  return {
    parser: 'chase-card',
    name: chaseProductName(normalized),
    mask,
    newBalance: money(newBalanceRaw.replace(/,/g, '')).toFixed(2),
    statementDate: statement?.toISOString() ?? null,
    periodStart: periodStart?.toISOString() ?? null,
    periodEnd: periodEnd?.toISOString() ?? null,
    creditLimit: parseLimit(normalized),
    transactions,
  }
}

export function isChaseCardStatement(text: string): boolean {
  const sample = text.slice(0, 20_000)
  const chase =
    /chase\.com/i.test(sample) ||
    /Chase Card Services/i.test(sample) ||
    /CARDMEMBER SERVICE/i.test(sample)
  const card = /Account\s+numbers?:/i.test(sample) && /New Balance/i.test(sample)
  return chase && card
}

export function transactionFingerprint(row: {
  postedAt: string
  amount: string
  description: string
}): string {
  return `${row.postedAt.slice(0, 10)}|${money(row.amount).toFixed(2)}|${row.description.trim().replace(/\s+/g, ' ').toLowerCase()}`
}

function chaseProductName(text: string): string {
  if (/Sapphire Reserve/i.test(text)) return 'Chase Sapphire Reserve'
  if (/Sapphire Preferred/i.test(text)) return 'Chase Sapphire Preferred'
  if (/Freedom Unlimited/i.test(text)) return 'Chase Freedom Unlimited'
  if (/Freedom Flex/i.test(text)) return 'Chase Freedom Flex'
  if (/Prime Visa/i.test(text)) return 'Chase Prime Visa'
  if (/Amazon/i.test(text) && /Visa/i.test(text)) return 'Chase Amazon Visa'
  return 'Chase credit card'
}

function transactionTable(text: string): string {
  const start =
    text.search(/Merchant Name or Transaction Description/i) >= 0
      ? text.search(/Merchant Name or Transaction Description/i)
      : text.search(/Date of\s+Transaction/i)
  if (start < 0) return text
  const sliced = text.slice(start)
  const end = sliced.search(/Total fees charged in \d{4}|Annual Percentage Rate \(APR\)/i)
  return end >= 0 ? sliced.slice(0, end) : sliced
}

function transactionLines(text: string): string[] {
  const lines: string[] = []
  for (const raw of transactionTable(text).split('\n')) {
    const line = raw.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line) continue
    const prev = lines[lines.length - 1]
    if (prev && AMOUNT_ONLY.test(line) && /^\d{2}\/\d{2}\b/.test(prev) && !TXN_LINE.test(prev)) {
      lines[lines.length - 1] = `${prev} ${line}`
      continue
    }
    lines.push(line)
  }
  return lines
}

function cleanDescription(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/^\$\s*/, '').trim()
}

function parseStatementAmount(value: string): string {
  const normalized = value.replace(/[$,]/g, '').trim()
  if (normalized.startsWith('.')) return `0${normalized}`
  if (normalized.startsWith('-.')) return `-0${normalized.slice(1)}`
  return normalized
}

function parseLimit(text: string): string | null {
  const match = text.match(/Credit Access Line\s+\$([0-9,]+)/)
  return match ? money(match[1].replace(/,/g, '')).toFixed(2) : null
}

function categoryFor(description: string): string | undefined {
  if (/payment thank you/i.test(description)) return 'Payment'
  return undefined
}

function firstMatch(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1] ?? null
}

function parseShortDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = 2000 + Number(match[3])
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function isoFromMonthDay(mmdd: string, periodEnd: Date): string {
  const [month, day] = mmdd.split('/').map(Number)
  let year = periodEnd.getUTCFullYear()
  const endMonth = periodEnd.getUTCMonth() + 1
  if (month - endMonth > 6) year -= 1
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString()
}
