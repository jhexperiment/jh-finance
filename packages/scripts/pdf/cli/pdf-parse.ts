#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { parseAmexCreditCard } from '../../../shared/src/parse/amex-card'
import { parseBohBankStatement } from '../../../shared/src/parse/boh-bank'
import { ParseError, parseChaseCreditCard } from '../../../shared/src/parse/chase-card'
import { parseCitiCreditCard } from '../../../shared/src/parse/citi-card'
import { extractPdfText } from '../lib/pdf-text'

export function createParseCommand(): Command {
  return new Command('parse')
    .description('Parse a statement PDF the same way the app does')
    .requiredOption('--input <path>', 'Path to the PDF file')
    .option('--chase', 'Parse as a Chase credit-card statement')
    .option('--amex', 'Parse as an American Express credit-card statement')
    .option('--citi', 'Parse as a Citi credit-card statement')
    .option('--boh', 'Parse as a Bank of Hawaii bank statement')
    .option('--raw', 'Also print the pdf.js text extract')
    .option('--output <path>', 'Write the parse result to this text file')
    .action(runParse)
}

async function runParse(options: {
  input: string
  chase?: boolean
  amex?: boolean
  citi?: boolean
  boh?: boolean
  raw?: boolean
  output?: string
}) {
  try {
    const inputPath = resolveInput(options.input)
    if (!inputPath.toLowerCase().endsWith('.pdf')) {
      throw new Error('Upload a PDF statement. CSV parsers are not wired yet.')
    }

    const bytes = new Uint8Array(await readFile(inputPath))
    let text: string
    try {
      text = await extractPdfText(bytes)
    } catch (error) {
      throw new Error(
        `Couldn't read that PDF (${error instanceof Error ? error.message : 'unknown error'}).`,
      )
    }

    const selected = [
      options.chase && 'chase',
      options.amex && 'amex',
      options.citi && 'citi',
      options.boh && 'boh',
    ].filter(Boolean)
    if (selected.length > 1) {
      throw new Error('Pass only one of --chase, --amex, --citi, or --boh.')
    }

    if (selected.length === 0) {
      await emit(text.endsWith('\n') ? text : `${text}\n`, options.output)
      process.exit(0)
    }

    const parsed = options.amex
      ? parseAmexCreditCard(text)
      : options.citi
        ? parseCitiCreditCard(text)
        : options.boh
          ? parseBohBankStatement(text)
          : parseChaseCreditCard(text)
    const output = options.raw ? { raw: text, parsed } : parsed
    await emit(`${JSON.stringify(output, null, 2)}\n`, options.output)
    process.exit(0)
  } catch (error) {
    const message =
      error instanceof ParseError || error instanceof Error ? error.message : 'Parse failed'
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

async function emit(body: string, output?: string) {
  process.stdout.write(body)
  if (!output) return
  const outputPath = path.resolve(output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, body)
}

function resolveInput(input: string): string {
  const fromCwd = path.resolve(input)
  if (existsSync(fromCwd)) return fromCwd
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
  const fromRepo = path.resolve(repoRoot, input)
  if (existsSync(fromRepo)) return fromRepo
  return fromCwd
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  await createParseCommand().parseAsync(process.argv)
}
