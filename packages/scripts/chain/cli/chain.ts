#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import {
  CHAINS,
  IndexerError,
  fetchAddressTransactions,
  isChain,
} from '../../../shared/src/chain'

export function createChainCommand(): Command {
  return new Command('txs')
    .description('Fetch all indexed transactions for a chain address or HD xpub/zpub')
    .requiredOption('--chain <chain>', `One of ${CHAINS.join(', ')}`)
    .requiredOption('--address <address>', 'Public address or HD xpub/ypub/zpub')
    .option('--output <path>', 'Write JSON to this file as well as stdout')
    .option('--etherscan-key <key>', 'Etherscan API key (BNB). Defaults to ETHERSCAN_API_KEY')
    .option(
      '--horizon-url <url>',
      'Stellar Horizon base URL. Defaults to STELLAR_HORIZON_URL or Blockdaemon if BLOCKDAEMON_API_KEY is set',
    )
    .option('--blockdaemon-key <key>', 'Blockdaemon API key for full-history XLM')
    .action(runFetch)
}

async function runFetch(options: {
  chain: string
  address: string
  output?: string
  etherscanKey?: string
  horizonUrl?: string
  blockdaemonKey?: string
}) {
  try {
    const chain = options.chain.toLowerCase()
    if (!isChain(chain)) {
      throw new IndexerError(`Unsupported chain "${options.chain}". Use one of: ${CHAINS.join(', ')}.`)
    }
    const log = (line: string) => process.stderr.write(`${line}\n`)
    log(`start ${chain} ${options.address}`)
    const rows = await fetchAddressTransactions({
      chain,
      address: options.address,
      etherscanApiKey: options.etherscanKey ?? process.env.ETHERSCAN_API_KEY,
      horizonUrl: options.horizonUrl ?? process.env.STELLAR_HORIZON_URL,
      blockdaemonApiKey: options.blockdaemonKey ?? process.env.BLOCKDAEMON_API_KEY,
      onLog: log,
    })
    log(`done ${rows.length} txs`)
    const body = `${JSON.stringify(rows, null, 2)}\n`
    process.stdout.write(body)
    if (options.output) {
      const outputPath = path.resolve(options.output)
      await mkdir(path.dirname(outputPath), { recursive: true })
      await writeFile(outputPath, body)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexer failed'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

const program = new Command()
program.name('chain').description('Chain address indexers')
program.addCommand(createChainCommand())

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const argv = process.argv.filter((arg, index) => index < 2 || arg !== '--')
  await program.parseAsync(argv)
}
