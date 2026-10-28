#!/usr/bin/env tsx
import { Command } from 'commander'
import { createGenerateRandomBase58Command } from './app-generate-random-base58'

const program = new Command()
program.name('app').description('App utility commands')
program.addCommand(createGenerateRandomBase58Command())
const argv = process.argv.filter((arg, index) => index < 2 || arg !== '--')
await program.parseAsync(argv)
