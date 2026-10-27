#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'

export function createReplaceCommand(): Command {
  return new Command('replace')
    .description('Replace strings in a text file using a Find/Replace CSV')
    .requiredOption('--source <path>', 'Path to the text file to update')
    .requiredOption('--input <path>', 'Path to the CSV with Find and Replace columns')
    .action(runReplace)
}

async function runReplace(options: { source: string; input: string }) {
  try {
    const sourcePath = resolveExisting(options.source, 'Source text file')
    const csvPath = resolveExisting(options.input, 'CSV file')
    const source = await readFile(sourcePath, 'utf8')
    const rows = parseReplaceCsv(await readFile(csvPath, 'utf8'))
    if (rows.length === 0) {
      throw new Error('CSV did not contain any Find values.')
    }

    let next = source
    const lines: string[] = []
    for (const row of rows) {
      const count = countOccurrences(next, row.find)
      next = next.split(row.find).join(row.replace)
      lines.push(`Replaced ${count} ${JSON.stringify(row.find)} → ${JSON.stringify(row.replace)}`)
    }

    await writeFile(sourcePath, next)
    process.stdout.write(`${lines.join('\n')}\nWrote ${sourcePath}\n`)
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Replace failed'
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

function parseReplaceCsv(text: string): Array<{ find: string; replace: string }> {
  const rows = parseCsv(text)
  const header = rows[0]?.map((cell) => cell.trim())
  if (!header) {
    throw new Error('CSV is empty.')
  }
  const findIdx = header.findIndex((cell) => /^find$/i.test(cell))
  const replaceIdx = header.findIndex((cell) => /^replace$/i.test(cell))
  if (findIdx < 0 || replaceIdx < 0) {
    throw new Error('CSV needs Find and Replace columns.')
  }
  return rows
    .slice(1)
    .map((row) => ({ find: row[findIdx] ?? '', replace: row[replaceIdx] ?? '' }))
    .filter((row) => row.find.length > 0)
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const body = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < body.length; i++) {
    const char = body[i]!
    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
        continue
      }
      cell += char
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char
  }
  if (quoted) {
    throw new Error('CSV has an unclosed quote.')
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value.length > 0))
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  return haystack.split(needle).length - 1
}

function resolveExisting(input: string, label: string): string {
  const fromCwd = path.resolve(input)
  if (existsSync(fromCwd)) return fromCwd
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
  const fromRepo = path.resolve(repoRoot, input)
  if (existsSync(fromRepo)) return fromRepo
  throw new Error(`${label} not found: ${input}`)
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  await createReplaceCommand().parseAsync(process.argv)
}
