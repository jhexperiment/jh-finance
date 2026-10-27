#!/usr/bin/env tsx
import { Command } from 'commander'
import { createParseCommand } from './pdf-parse'
import { createReplaceCommand } from './pdf-replace'

const program = new Command()
program.name('pdf').description('PDF statement tools')
program.addCommand(createParseCommand())
program.addCommand(createReplaceCommand())
const argv = process.argv.filter((arg, index) => index < 2 || arg !== '--')
await program.parseAsync(argv)
