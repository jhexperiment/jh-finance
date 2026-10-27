import { money } from '../money'
import {
  ParseError,
  type ParsedCardStatement,
  type ParsedCardTransaction,
} from './chase-card'

const TXN_LINE =
  /^(\d{2}\/\d{2}\/\d{2})\*?\s+(.+?)\s+(-?\$[0-9,]+\.\d{2})$/
const AMOUNT_ONLY = /^-?\$[0-9,]+\.\d{2}$/
const SKIP_LINE =
  /^(card ending|date\s+description|\*indicates posting date|category\b|account details\b|total |payments details|new charges details|fees$)/i

export function parseAmexCreditCard(text: string): ParsedCardStatement {
  const normalized = text.replace(/\r/g, '\n').replace(/\u00a0/g, ' ')
  if (!isAmexCardStatement(normalized)) {
    throw new ParseError("Couldn't read this as an American Express credit-card statement.")
  }

  const mask = amexMask(normalized)
  if (!mask) {
    throw new ParseError('American Express statement is missing an account ending.')
  }

  const newBalanceRaw =
    firstMatch(normalized, /(?:Equals )?New Balance\s+\$([0-9,]+\.\d{2})/) ??
    firstMatch(normalized, /New Balance[\s\S]{0,40}?\$([0-9,]+\.\d{2})/)
  if (!newBalanceRaw) {
    throw new ParseError('American Express statement is missing a new balance.')
  }

  const closing = parseShortDate(firstMatch(normalized, /Closing Date\s+(\d{2}\/\d{2}\/\d{2})/))
  const billingDays = Number(firstMatch(normalized, /Days in Billing Period:\s+(\d+)/) ?? '')
  const periodEnd = closing
  const periodStart =
    closing && billingDays > 0
      ? new Date(closing.getTime() - (billingDays - 1) * 24 * 60 * 60 * 1000)
      : null

  const transactions: ParsedCardTransaction[] = []
  const seen = new Set<string>()
  for (const line of transactionLines(normalized)) {
    if (SKIP_LINE.test(line) || /^order number\b/i.test(line)) continue
    const match = line.match(TXN_LINE)
    if (!match) continue
    const description = cleanDescription(match[2])
    if (!description || isContinuation(description)) continue
    const statementAmount = parseStatementAmount(match[3])
    const postedAt = parseShortDate(match[1])
    if (!postedAt) continue
    const amount = money(statementAmount).neg().toFixed(2)
    const fingerprint = `${postedAt.toISOString().slice(0, 10)}|${amount}|${description.toLowerCase()}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    transactions.push({
      postedAt: postedAt.toISOString(),
      description,
      amount,
      category: categoryFor(description),
    })
  }

  if (transactions.length === 0) {
    throw new ParseError("American Express statement didn't contain any transactions we could read.")
  }

  return {
    parser: 'american-express-card',
    name: amexProductName(normalized),
    mask,
    newBalance: money(newBalanceRaw.replace(/,/g, '')).toFixed(2),
    statementDate: closing?.toISOString() ?? null,
    periodStart: periodStart?.toISOString() ?? null,
    periodEnd: periodEnd?.toISOString() ?? null,
    creditLimit: parseLimit(normalized),
    transactions,
  }
}

export function isAmexCardStatement(text: string): boolean {
  const sample = text.slice(0, 20_000)
  const amex =
    /americanexpress\.com/i.test(sample) ||
    /American Express/i.test(sample) ||
    /from American Express/i.test(sample)
  const card = /Account Ending/i.test(sample) && /New Balance/i.test(sample)
  return amex && card
}

function amexMask(text: string): string | null {
  const ending = text.match(/Account Ending\s+(\d-)?(\d{4,5})/i)
  return ending?.[2] ?? null
}

function amexProductName(text: string): string {
  if (/Blue Cash Preferred/i.test(text)) return 'Amex Blue Cash Preferred'
  if (/Blue Cash Everyday/i.test(text)) return 'Amex Blue Cash Everyday'
  if (/Platinum/i.test(text)) return 'Amex Platinum'
  if (/Gold Card/i.test(text)) return 'Amex Gold'
  if (/Green Card/i.test(text)) return 'Amex Green'
  if (/Delta SkyMiles/i.test(text)) return 'Amex Delta SkyMiles'
  return 'Amex credit card'
}

function transactionTable(text: string): string {
  const start = text.search(/Payments Details/i)
  const sliced = start >= 0 ? text.slice(start) : text
  const end = sliced.search(/About Trailing Interest|Interest Charge Calculation/i)
  return end >= 0 ? sliced.slice(0, end) : sliced
}

function transactionLines(text: string): string[] {
  const lines: string[] = []
  for (const raw of transactionTable(text).split('\n')) {
    const line = raw.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line) continue
    const prev = lines[lines.length - 1]
    if (prev && AMOUNT_ONLY.test(line) && /^\d{2}\/\d{2}\/\d{2}/.test(prev) && !TXN_LINE.test(prev)) {
      lines[lines.length - 1] = `${prev} ${line}`
      continue
    }
    lines.push(line)
  }
  return lines
}

function isContinuation(description: string): boolean {
  return (
    /^\+?\d{10,}/.test(description) ||
    /^\d{6,}\s*\//.test(description) ||
    /helppay@/i.test(description) ||
    /^(WEB SERVICES|AUDIO BOOKS|COMPUTER NETWORK|VIDEO RENTAL)/i.test(description)
  )
}

function categoryFor(description: string): string | undefined {
  if (/payment/i.test(description) && /thank you/i.test(description)) return 'Payment'
  if (/annual fee/i.test(description) || /^fee\b/i.test(description)) return 'Fee'
  return undefined
}

function cleanDescription(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/^\$\s*/, '').trim()
}

function parseStatementAmount(value: string): string {
  return value.replace(/[$,]/g, '').trim()
}

function parseLimit(text: string): string | null {
  const match = text.match(/Credit Limit\s+\$([0-9,]+\.\d{2})/)
  return match ? money(match[1].replace(/,/g, '')).toFixed(2) : null
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
