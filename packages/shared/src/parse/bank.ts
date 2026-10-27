import { isBohBankStatement, parseBohBankStatement, type ParsedBankStatement } from './boh-bank'
import { ParseError } from './chase-card'

export function parseBankStatement(text: string): ParsedBankStatement {
  if (isBohBankStatement(text)) return parseBohBankStatement(text)
  throw new ParseError("Couldn't read this as a Bank of Hawaii bank statement.")
}
