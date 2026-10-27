import { money } from '../money'
import { ParseError } from './chase-card'

export interface ParsedBankTransaction {
  postedAt: string
  description: string
  amount: string
  category?: string
}

export type BankParser = 'boh-bank'

export interface ParsedBankAccount {
  name: string
  mask: string
  subtype: string
  newBalance: string
  transactions: ParsedBankTransaction[]
}

export interface ParsedBankStatement {
  parser: BankParser
  statementDate: string | null
  periodStart: string | null
  periodEnd: string | null
  accounts: ParsedBankAccount[]
}

const AMOUNT_TOKEN = /^\$?-?[0-9,]*(?:\.\d{1,2})$/
const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

export function parseBohBankStatement(text: string): ParsedBankStatement {
  const normalized = normalizeBohText(text)
  if (!isBohBankStatement(normalized)) {
    throw new ParseError("Couldn't read this as a Bank of Hawaii bank statement.")
  }

  const statement = parseEnglishDate(firstMatch(normalized, /This statement:\s+([A-Za-z]+ \d{1,2}, \d{4})/i))
  const lastStatement = parseEnglishDate(
    firstMatch(normalized, /Last statement:\s+([A-Za-z]+ \d{1,2}, \d{4})/i),
  )
  const periodEnd = statement
  const periodStart = lastStatement
  const summaries = parseSummary(normalized)

  const accounts: ParsedBankAccount[] = []
  const seenMasks = new Set<string>()
  for (const section of accountSections(normalized)) {
    const account = parseAccountSection(section, summaries, periodEnd ?? statement ?? new Date())
    if (!account || seenMasks.has(account.mask)) continue
    seenMasks.add(account.mask)
    accounts.push(account)
  }

  if (accounts.length === 0 || accounts.every((account) => account.transactions.length === 0)) {
    throw new ParseError("Bank of Hawaii statement didn't contain any transactions we could read.")
  }

  return {
    parser: 'boh-bank',
    statementDate: statement?.toISOString() ?? null,
    periodStart: periodStart?.toISOString() ?? null,
    periodEnd: periodEnd?.toISOString() ?? null,
    accounts,
  }
}

export function isBohBankStatement(text: string): boolean {
  const sample = normalizeBohText(text).slice(0, 20_000)
  const boh =
    /bank of hawai['’]?i/i.test(sample) ||
    /www\.boh\.com/i.test(sample) ||
    /boh\.c/i.test(sample) ||
    /Bankohana/i.test(sample)
  const bank = /Statement of Account/i.test(sample) && /SUMMARY\s*OF\s*ACCOUNT\s*BALANCES/i.test(sample)
  return boh && bank
}

const GLUE_SUFFIX = /^(TION|MENT|NESS|ING|CARD|YCARD|WN|TG|TE|AII)$/i
const GLUE_STOP = new Set([
  'OF',
  'TO',
  'ST',
  'HI',
  'US',
  'OR',
  'IN',
  'ON',
  'NO',
  'AM',
  'WEB',
  'ACH',
  'CRD',
  'INT',
  'APY',
  'THE',
  'AND',
  'FOR',
  'YOU',
  'FDIC',
  'III',
  'II',
  'CA',
])

function normalizeBohText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(normalizeBohLine)
    .join('\n')
}

function normalizeBohLine(line: string): string {
  let tokens = line.split(/\t+/).map((token) => token.trim()).filter(Boolean)
  if (tokens.length === 0) return collapse(line)
  tokens = downsampleInterleaved(tokens)
  tokens = mergeSingleRuns(tokens)
  tokens = glueSplitWords(tokens)
  return tokens.join(' ').replace(/\s+/g, ' ').trim()
}

function downsampleInterleaved(tokens: string[]): string[] {
  for (const copies of [4, 2]) {
    if (tokens.length < copies * 2 || tokens.length % copies !== 0) continue
    let matched = true
    for (let i = 0; i < tokens.length && matched; i += copies) {
      const first = tokens[i]
      for (let j = 1; j < copies; j++) {
        if (tokens[i + j] !== first) {
          matched = false
          break
        }
      }
    }
    if (!matched) continue
    const downsampled: string[] = []
    for (let i = 0; i < tokens.length; i += copies) downsampled.push(tokens[i]!)
    return downsampled
  }
  return tokens
}

function mergeSingleRuns(tokens: string[]): string[] {
  const out: string[] = []
  let run: string[] = []
  const flush = () => {
    if (run.length === 0) return
    if (run.length === 1) out.push(run[0]!)
    else out.push(...reconstructSingles(run).split(/\s+/).filter(Boolean))
    run = []
  }
  for (const token of tokens) {
    if (token.length === 1) {
      run.push(token)
      continue
    }
    flush()
    out.push(token)
  }
  flush()
  return out
}

function reconstructSingles(chars: string[]): string {
  const parts: string[] = []
  let buf = ''
  const flush = () => {
    if (buf) parts.push(buf)
    buf = ''
  }
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!
    const prev = buf.slice(-1)
    const next = chars[i + 1]
    if (char === '-' && /[A-Za-z]/.test(prev)) {
      flush()
      parts.push('-')
      continue
    }
    if (char === '$') {
      flush()
      buf = '$'
      continue
    }
    if (char === '.' && /\.\d{2}$/.test(buf)) {
      flush()
      buf = '.'
      continue
    }
    if (/[A-Z]/.test(char) && /[a-z]/.test(prev)) {
      flush()
      buf = char
      continue
    }
    if (/[A-Z]/.test(char) && /[A-Z]/.test(prev) && next && /[a-z]/.test(next)) {
      flush()
      buf = char
      continue
    }
    if (/[0-9]/.test(char) && /[A-Za-z]/.test(prev)) {
      flush()
      buf = char
      continue
    }
    if (/[A-Za-z]/.test(char) && /[0-9]/.test(prev)) {
      flush()
      buf = char
      continue
    }
    buf += char
  }
  flush()
  return parts.join(' ')
}

function glueSplitWords(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const prev = out[out.length - 1]
    const next = tokens[i + 1]
    if (isWordPart(token) && token.length === 1) {
      if (next && isWordPart(next) && /^[a-z]/.test(next)) {
        tokens[i + 1] = `${token}${next}`
        continue
      }
      const articleBeforeWord = (token === 'A' || token === 'I') && next && isWordPart(next) && next.length >= 4
      if (prev && isWordPart(prev) && !articleBeforeWord && (prev.length <= 4 || /^[A-Z]+$/.test(prev))) {
        out[out.length - 1] = `${prev}${token}`
        continue
      }
    }
    if (prev && shouldGlue(prev, token)) {
      out[out.length - 1] = `${prev}${token}`
      continue
    }
    out.push(token)
  }
  return out
}

function shouldGlue(left: string, right: string): boolean {
  if (/^\d{2}-\d$/.test(left) && /^\d$/.test(right)) return true
  if (!isWordPart(left) || !isWordPart(right)) return false
  if (GLUE_SUFFIX.test(right)) return true
  return (
    /^[A-Z]+$/.test(left) &&
    /^[A-Z]+$/.test(right) &&
    left.length <= 3 &&
    right.length <= 3 &&
    !GLUE_STOP.has(left) &&
    !GLUE_STOP.has(right)
  )
}

function isWordPart(value: string): boolean {
  return /^[A-Za-z0-9']+$/.test(value)
}

function folded(value: string): string {
  return value.replace(/[\s-]/g, '').toLowerCase()
}

function isFoldedHeader(line: string, ...names: string[]): boolean {
  const value = folded(line)
  return names.some((name) => value === folded(name))
}

function parseSummary(text: string): Array<{ name: string; mask: string; endingBalance: string }> {
  const start = text.search(/SUMMARY\s*OF\s*ACCOUNT\s*BALANCES/i)
  if (start < 0) return []
  const sliced = text.slice(start)
  const end = sliced.search(/Account number\s+[\d-]+/i)
  const block = end >= 0 ? sliced.slice(0, end) : sliced.slice(0, 2_000)
  const rows: Array<{ name: string; mask: string; endingBalance: string }> = []
  for (const raw of block.split('\n')) {
    const line = collapse(raw)
    const match = line.match(/^(Bankohana.+?)\s+([\d-]+)\s+\$([0-9,]+\.\d{2})$/i)
    if (!match) continue
    rows.push({
      name: match[1].trim(),
      mask: match[2],
      endingBalance: money(match[3].replace(/,/g, '')).toFixed(2),
    })
  }
  return rows
}

function accountSections(text: string): string[] {
  const matches = [...text.matchAll(/Account number\s+[\d-]+/gi)]
  if (matches.length === 0) return []
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const before = text.slice(Math.max(0, start - 300), start)
    const header = before.match(/Bankohana[^\n]*$/i)?.[0] ?? ''
    const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? text.length) : text.length
    return `${header}\n${text.slice(start, end)}`
  })
}

function parseAccountSection(
  section: string,
  summaries: Array<{ name: string; mask: string; endingBalance: string }>,
  periodEnd: Date,
): ParsedBankAccount | null {
  const accountNumber = firstMatch(section, /Account number\s+([\d-]+)/i)
  if (!accountNumber) return null
  const mask = maskFromAccountNumber(accountNumber)
  const summary = summaries.find((row) => masksMatch(row.mask, mask) || masksMatch(row.mask, accountNumber))
  const name = productName(section, summary?.name)
  const subtype = /checking/i.test(name) ? 'Checking' : 'Savings'
  const foldedSection = folded(section)
  const transactions =
    foldedSection.includes('dailyactivity') && !foldedSection.includes('debits')
      ? parseDailyActivity(section, periodEnd)
      : parseDebitCredit(section, periodEnd)
  const newBalance =
    parseEndingBalance(section) ?? lastRunningBalance(section) ?? summary?.endingBalance
  if (!newBalance) {
    throw new ParseError(`Bank of Hawaii statement is missing an ending balance for ${name}.`)
  }
  return { name, mask, subtype, newBalance, transactions }
}

function parseDebitCredit(section: string, periodEnd: Date): ParsedBankTransaction[] {
  const transactions: ParsedBankTransaction[] = []
  let mode: 'debits' | 'credits' | null = null
  for (const raw of section.split('\n')) {
    const line = collapse(raw)
    if (!line) continue
    if (isFoldedHeader(line, 'DEBITS')) {
      mode = 'debits'
      continue
    }
    if (isFoldedHeader(line, 'CREDITS')) {
      mode = 'credits'
      continue
    }
    if (isFoldedHeader(line, 'DAILY BALANCES', 'INTEREST INFORMATION')) {
      mode = null
      continue
    }
    if (!mode || shouldSkipLine(line)) continue
    const dated = splitDatedLine(line)
    if (dated) {
      if (isBalanceOnlyDescription(dated.description)) continue
      const signed = mode === 'debits' ? money(dated.amounts[0]!).neg() : money(dated.amounts[0]!)
      pushTransaction(transactions, dated.date, dated.description, signed.toFixed(2), periodEnd)
      continue
    }
    appendContinuation(transactions, line)
  }
  return transactions
}

function parseDailyActivity(section: string, periodEnd: Date): ParsedBankTransaction[] {
  const start = section.search(/DAILY\s*ACTIVITY/i)
  const body = start >= 0 ? section.slice(start) : section
  const transactions: ParsedBankTransaction[] = []
  let previousBalance: string | null = null
  for (const raw of body.split('\n')) {
    const line = collapse(raw)
    if (!line) continue
    if (isFoldedHeader(line, 'INTEREST INFORMATION')) break
    if (shouldSkipLine(line)) continue
    const dated = splitDatedLine(line)
    if (!dated) {
      appendContinuation(transactions, line)
      continue
    }
    if (/^beginning balance$/i.test(dated.description)) {
      previousBalance = dated.amounts[dated.amounts.length - 1] ?? previousBalance
      continue
    }
    if (/^ending totals$/i.test(dated.description)) {
      previousBalance = dated.amounts[dated.amounts.length - 1] ?? previousBalance
      continue
    }
    if (dated.amounts.length >= 3) {
      const [addition, subtraction, balance] = dated.amounts
      if (!money(addition!).isZero()) {
        pushTransaction(transactions, dated.date, dated.description, money(addition!).toFixed(2), periodEnd)
      }
      if (!money(subtraction!).isZero()) {
        pushTransaction(
          transactions,
          dated.date,
          dated.description,
          money(subtraction!).neg().toFixed(2),
          periodEnd,
        )
      }
      previousBalance = balance ?? previousBalance
      continue
    }
    const delta = dated.amounts[0]!
    const balance = dated.amounts[1]
    let signed = money(delta)
    if (balance && previousBalance) {
      if (money(balance).lt(previousBalance)) signed = signed.neg()
      else if (money(balance).eq(previousBalance)) continue
    }
    if (signed.isZero()) {
      previousBalance = balance ?? previousBalance
      continue
    }
    pushTransaction(transactions, dated.date, dated.description, signed.toFixed(2), periodEnd)
    previousBalance = balance ?? previousBalance
  }
  return transactions
}

function pushTransaction(
  transactions: ParsedBankTransaction[],
  mmdd: string,
  description: string,
  amount: string,
  periodEnd: Date,
) {
  const cleaned = cleanDescription(description)
  if (!cleaned || isBalanceOnlyDescription(cleaned)) return
  const postedAt = isoFromMonthDay(mmdd, periodEnd)
  const fingerprint = `${postedAt.slice(0, 10)}|${amount}|${cleaned.toLowerCase()}`
  if (transactions.some((row) => `${row.postedAt.slice(0, 10)}|${row.amount}|${row.description.toLowerCase()}` === fingerprint)) {
    return
  }
  transactions.push({
    postedAt,
    description: cleaned,
    amount,
    category: categoryFor(cleaned),
  })
}

function appendContinuation(transactions: ParsedBankTransaction[], line: string) {
  const last = transactions[transactions.length - 1]
  if (!last || !isUsefulContinuation(line) || shouldSkipLine(line)) return
  last.description = cleanDescription(`${last.description} ${line}`)
}

function splitDatedLine(line: string): { date: string; description: string; amounts: string[] } | null {
  const match = line.match(/^(\d{2}-\d{2})\s+(.+)$/)
  if (!match) return null
  const tokens = match[2].split(/\s+/)
  const amounts: string[] = []
  while (tokens.length > 0) {
    const token = tokens[tokens.length - 1]!
    if (!AMOUNT_TOKEN.test(token) || !/[0-9]/.test(token)) break
    amounts.unshift(parseStatementAmount(tokens.pop()!))
  }
  const description = tokens.join(' ').trim()
  if (!description || amounts.length === 0) return null
  return { date: match[1], description, amounts }
}

function parseEndingBalance(section: string): string | null {
  const ending = section.match(/Ending balance\s+\$\s*([0-9,]+\.\d{2})/i)
  if (ending) return money(ending[1].replace(/,/g, '')).toFixed(2)
  for (const raw of section.split('\n')) {
    const line = collapse(raw)
    const dated = splitDatedLine(line)
    if (dated && /^ending totals$/i.test(dated.description)) {
      const last = dated.amounts[dated.amounts.length - 1]
      if (last) return money(last).toFixed(2)
    }
  }
  return null
}

function lastRunningBalance(section: string): string | null {
  let last: string | null = null
  for (const raw of section.split('\n')) {
    const dated = splitDatedLine(collapse(raw))
    if (!dated || dated.amounts.length < 2) continue
    last = dated.amounts[dated.amounts.length - 1] ?? last
  }
  return last ? money(last).toFixed(2) : null
}

function productName(section: string, summaryName?: string): string {
  const sample = `${summaryName ?? ''} ${section}`
  if (/checking/i.test(sample)) return 'Bank of Hawaii Checking'
  if (/bonus/i.test(sample)) return 'Bank of Hawaii Bonus Savings'
  if (/savings/i.test(sample)) return 'Bank of Hawaii Savings'
  return 'Bank of Hawaii'
}

function maskFromAccountNumber(value: string): string {
  const compact = value.replace(/\s/g, '')
  const digits = compact.replace(/\D/g, '')
  if (digits.length <= 4) return digits
  if (compact.includes('-')) return compact
  return digits.slice(-4)
}

export function masksMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false
  const a = left.replace(/\D/g, '')
  const b = right.replace(/\D/g, '')
  if (!a || !b) return false
  const min = Math.min(a.length, b.length)
  if (min < 3) return a === b
  return a === b || a.endsWith(b) || b.endsWith(a)
}

function shouldSkipLine(line: string): boolean {
  return (
    isFoldedHeader(
      line,
      'DEBITS',
      'CREDITS',
      'DAILY BALANCES',
      'DAILY ACTIVITY',
      'INTEREST INFORMATION',
      'DATE DESCRIPTION SUBTRACTIONS',
      'DATE DESCRIPTION ADDITIONS',
      'DATE DESCRIPTION ADDITIONS SUBTRACTIONS BALANCE',
    ) ||
    /^(page\b|date\s+description|annual percentage yield|interest-bearing days|average balance for apy|average balance\b|low balance\b|ending balance\b|beginning balance\b|total (additions|subtractions|days)|account number\b|click here|direct inquiries|number of enclosures|primary account|this statement|last statement|statement of account|summary of account|when it comes to banking|from conveniently|pride in bringing|member f?dic|www\.boh\.com|bankohana\b|name\d+)/i.test(
      line,
    ) ||
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}/i.test(
      line,
    ) ||
    /^\d{4}-\d{6}$/.test(line) ||
    /^\d{1,3}$/.test(line) ||
    /^[a-z]$/i.test(line)
  )
}

function isBalanceOnlyDescription(description: string): boolean {
  return /^(beginning balance|ending totals|ending balance)$/i.test(description)
}

function isUsefulContinuation(line: string): boolean {
  if (/[a-z]/i.test(line)) return true
  return line.replace(/\D/g, '').length >= 3
}

function categoryFor(description: string): string | undefined {
  if (/\bint(?:erest)?\b/i.test(description)) return 'Interest'
  if (/transfer/i.test(description)) return 'Transfer'
  return undefined
}

function cleanDescription(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseStatementAmount(value: string): string {
  const normalized = value.replace(/[$,]/g, '').trim()
  if (normalized.startsWith('.')) return `0${normalized}`
  if (normalized.startsWith('-.')) return `-0${normalized.slice(1)}`
  return normalized
}

function firstMatch(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1] ?? null
}

function collapse(line: string): string {
  return line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseEnglishDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/)
  if (!match) return null
  const month = MONTHS[match[1].toLowerCase()]
  if (month === undefined) return null
  return new Date(Date.UTC(Number(match[3]), month, Number(match[2]), 12, 0, 0))
}

function isoFromMonthDay(mmdd: string, periodEnd: Date): string {
  const [month, day] = mmdd.split('-').map(Number)
  let year = periodEnd.getUTCFullYear()
  const endMonth = periodEnd.getUTCMonth() + 1
  if (month - endMonth > 6) year -= 1
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString()
}
