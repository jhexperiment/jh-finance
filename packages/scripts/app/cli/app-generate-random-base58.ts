#!/usr/bin/env tsx
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const DEFAULT_BYTES = 16

export function createGenerateRandomBase58Command(): Command {
  return new Command('generate-random-base58')
    .description('Print a Bitcoin-base58 encoding of random bytes')
    .argument('[bytes]', 'Number of random bytes to encode', String(DEFAULT_BYTES))
    .action(run)
}

function run(bytesArg: string) {
  try {
    process.stdout.write(`${encodeBase58(randomBytes(parseByteCount(bytesArg)))}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate base58'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

function parseByteCount(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`Bytes must be a positive integer, got "${value}".`)
  }
  return Number(value)
}

export function encodeBase58(buffer: Uint8Array): string {
  let value = buffer.length ? BigInt(`0x${Buffer.from(buffer).toString('hex')}`) : 0n
  let encoded = ''
  while (value > 0n) {
    encoded = BASE58[Number(value % 58n)] + encoded
    value /= 58n
  }
  let zeros = 0
  while (zeros < buffer.length && buffer[zeros] === 0) zeros += 1
  return BASE58[0].repeat(zeros) + encoded
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const argv = process.argv.filter((arg, index) => index < 2 || arg !== '--')
  await createGenerateRandomBase58Command().parseAsync(argv)
}
