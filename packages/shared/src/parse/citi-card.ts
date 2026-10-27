import { money } from '../money'
import {
  ParseError,
  type ParsedCardStatement,
  type ParsedCardTransaction,
} from './chase-card'

const TXN_LINE =
  /^(\d{2}\/\d{2})(?:\s+(\d{2}\/\d{2}))?\s+(.+?)\s+(- ?\$[0-9,]+\.\d{2}|\$[0-9,]+\.\d{2})$/
const AMOUNT_ONLY = /^(- ?\$[0-9,]+\.\d{2}|\$[0-9,]+\.\d{2})$/

export function parseCitiCreditCard(text: string): ParsedCardStatement {
  const normalized = text.replace(/\r/g, '\n').replace(/\u00a0/g, ' ')
  if (!isCitiCardStatement(normalized)) {
    throw new ParseError("Couldn't read this as a Citi credit-card statement.")
  }

  const mask = firstMatch(normalized, /Account number ending in:?\s*(\d{4})/i)
  if (!mask) {
    throw new ParseError('Citi statement is missing an account ending.')
  }

  const newBalanceRaw =
    firstMatch(normalized, /New balance as of \d{2}\/\d{2}\/\d{2}:\s+\$([0-9,]+\.\d{2})/i) ??
    firstMatch(normalized, /New balance\s+\$([0-9,]+\.\d{2})/i)
  if (!newBalanceRaw) {
    throw new ParseError('Citi statement is missing a new balance.')
  }

  const period = normalized.match(
    /Billing Period:\s+(\d{2}\/\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2}\/\d{2})/i,
  )
  const periodStart = parseShortDate(period?.[1])
  const periodEnd = parseShortDate(period?.[2])
  const asOf = firstMatch(normalized, /New balance as of (\d{2}\/\d{2}\/\d{2})/i)
  const statement = parseShortDate(asOf) ?? periodEnd

  const transactions: ParsedCardTransaction[] = []
  const seen = new Set<string>()
  for (const line of transactionLines(normalized)) {
    const match = line.match(TXN_LINE)
    if (!match) continue
    const description = cleanDescription(match[3])
    if (!description || isHeader(description)) continue
    const statementAmount = parseStatementAmount(match[4])
    const postedAt = isoFromMonthDay(
      match[2] ?? match[1],
      periodEnd ?? statement ?? new Date(),
    )
    const amount = money(statementAmount).neg().toFixed(2)
    const fingerprint = `${postedAt.slice(0, 10)}|${amount}|${description.toLowerCase()}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    transactions.push({
      postedAt,
      description,
      amount,
      category: categoryFor(description, statementAmount),
    })
  }

  if (transactions.length === 0) {
    throw new ParseError("Citi statement didn't contain any transactions we could read.")
  }

  return {
    parser: 'citi-card',
    name: citiProductName(normalized),
    mask,
    newBalance: money(newBalanceRaw.replace(/,/g, '')).toFixed(2),
    statementDate: statement?.toISOString() ?? null,
    periodStart: periodStart?.toISOString() ?? null,
    periodEnd: periodEnd?.toISOString() ?? null,
    creditLimit: parseLimit(normalized),
    transactions,
  }
}

export function isCitiCardStatement(text: string): boolean {
  const sample = text.slice(0, 20_000)
  const citi =
    /universalcard\.com/i.test(sample) ||
    /citigroup/i.test(sample) ||
    /www\.citi\.com/i.test(sample) ||
    /\bCiti Cards\b/i.test(sample) ||
    /\bCiti\b/i.test(sample) && /ThankYou/i.test(sample)
  const card = /Account number ending in/i.test(sample) && /New balance/i.test(sample)
  return citi && card
}

function citiProductName(text: string): string {
  if (/AT&T Universal/i.test(text)) return 'Citi AT&T Universal'
  if (/Costco Anywhere/i.test(text)) return 'Citi Costco Anywhere'
  if (/Double Cash/i.test(text)) return 'Citi Double Cash'
  if (/Custom Cash/i.test(text)) return 'Citi Custom Cash'
  if (/Premier/i.test(text)) return 'Citi Premier'
  if (/Simplicity/i.test(text)) return 'Citi Simplicity'
  if (/ThankYou Preferred/i.test(text)) return 'Citi ThankYou Preferred'
  return 'Citi credit card'
}

function transactionTable(text: string): string {
  const start =
    text.search(/Payments, Credits and Adjustments/i) >= 0
      ? text.search(/Payments, Credits and Adjustments/i)
      : text.search(/Trans\.\s+Post/i)
  if (start < 0) return text
  const sliced = text.slice(start)
  const end = sliced.search(
    /Fees Charged|Total fees charged in this billing period|Interest Charged/i,
  )
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

function isHeader(description: string): boolean {
  return /^(standard\s*p?\s*urchases|payments, credits|trans\.|post date|description|amount)$/i.test(
    description,
  )
}

function categoryFor(description: string, statementAmount: string): string | undefined {
  if (/payment/i.test(description) && /thank you/i.test(description)) return 'Payment'
  if (money(statementAmount).isNegative()) return 'Credit'
  return undefined
}

function cleanDescription(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/^\$\s*/, '').replace(/\s+-\s*$/, '').trim()
}

function parseStatementAmount(value: string): string {
  return value.replace(/[$,]/g, '').replace(/\s+/g, '').trim()
}

function parseLimit(text: string): string | null {
  const match = text.match(/Credit limit\s+\$([0-9,]+)/i)
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

function isoFromMonthDay(mmdd: string, periodEnd: Date): string {
  const [month, day] = mmdd.split('/').map(Number)
  let year = periodEnd.getUTCFullYear()
  const endMonth = periodEnd.getUTCMonth() + 1
  if (month - endMonth > 6) year -= 1
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString()
}
