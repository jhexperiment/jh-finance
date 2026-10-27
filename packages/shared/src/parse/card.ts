import { parseAmexCreditCard, isAmexCardStatement } from './amex-card'
import { parseChaseCreditCard, isChaseCardStatement, ParseError, type ParsedCardStatement } from './chase-card'
import { parseCitiCreditCard, isCitiCardStatement } from './citi-card'

export function parseCardStatement(text: string): ParsedCardStatement {
  if (isChaseCardStatement(text)) return parseChaseCreditCard(text)
  if (isAmexCardStatement(text)) return parseAmexCreditCard(text)
  if (isCitiCardStatement(text)) return parseCitiCreditCard(text)
  throw new ParseError(
    "Couldn't read this as a Chase, American Express, or Citi credit-card statement.",
  )
}
