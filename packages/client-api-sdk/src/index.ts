import {
  type AccountSummary,
  type BankAccount,
  type BanksOverview,
  type BillsOverview,
  type CardAccount,
  type CardsOverview,
  type ChainAddressSyncResult,
  type CreateAccountInput,
  type CreateBillInput,
  type CreateChainAddressInput,
  type CreateHoldingInput,
  type CreateTransactionInput,
  type InsurancePolicy,
  type InvestmentAccount,
  type InvestmentsOverview,
  type LedgerAccount,
  type LedgerBill,
  type LedgerChainAddress,
  type LedgerHolding,
  type LedgerTransaction,
  type OverviewSnapshot,
  type UpdateAccountInput,
  type BankStatementImportResult,
  type BankStatementOverlap,
  type CardStatementImportResult,
  type CardStatementOverlap,
  type UpdateBillInput,
  type UtilityAccount,
  ParseError,
  parseBankStatement,
  parseCardStatement,
} from 'shared'
import { MemoryLedger, views } from './memory'
import { extractPdfText } from './pdf-text'

export interface ClientApi {
  getOverview: () => Promise<OverviewSnapshot>
  getCardsOverview: () => Promise<CardsOverview>
  getCards: () => Promise<CardAccount[]>
  getCard: (id: string) => Promise<CardAccount>
  getBanksOverview: () => Promise<BanksOverview>
  getBanks: () => Promise<BankAccount[]>
  getBank: (id: string) => Promise<BankAccount>
  getInvestmentsOverview: () => Promise<InvestmentsOverview>
  getInvestments: () => Promise<InvestmentAccount[]>
  getInvestment: (id: string) => Promise<InvestmentAccount>
  getBillsOverview: () => Promise<BillsOverview>
  getUtilities: () => Promise<UtilityAccount[]>
  getUtility: (id: string) => Promise<UtilityAccount>
  getInsurance: () => Promise<InsurancePolicy[]>
  getAccounts: () => Promise<AccountSummary[]>
  getAccount: (id: string) => Promise<LedgerAccount>
  getBill: (id: string) => Promise<LedgerBill>
  createAccount: (input: CreateAccountInput) => Promise<LedgerAccount>
  updateAccount: (id: string, input: UpdateAccountInput) => Promise<LedgerAccount>
  deleteAccount: (id: string) => Promise<void>
  createTransaction: (input: CreateTransactionInput) => Promise<LedgerTransaction>
  deleteTransaction: (id: string) => Promise<void>
  createHolding: (input: CreateHoldingInput) => Promise<LedgerHolding>
  deleteHolding: (id: string) => Promise<void>
  createBill: (input: CreateBillInput) => Promise<LedgerBill>
  updateBill: (id: string, input: UpdateBillInput) => Promise<LedgerBill>
  deleteBill: (id: string) => Promise<void>
  importCardStatement: (input: {
    file: File
    confirm?: 'replace'
  }) => Promise<CardStatementImportResult>
  importBankStatement: (input: {
    file: File
    confirm?: 'replace'
  }) => Promise<BankStatementImportResult>
  listChainAddresses: (accountId: string) => Promise<LedgerChainAddress[]>
  createChainAddress: (
    accountId: string,
    input: Omit<CreateChainAddressInput, 'accountId'>,
  ) => Promise<LedgerChainAddress>
  deleteChainAddress: (accountId: string, addressId: string) => Promise<void>
  syncChainAddress: (accountId: string, addressId: string) => Promise<ChainAddressSyncResult>
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 404,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class StatementOverlapError extends Error {
  constructor(readonly overlap: CardStatementOverlap | BankStatementOverlap) {
    super(
      `This statement overlaps ${overlap.overlapCount} existing ${overlap.overlapCount === 1 ? 'transaction' : 'transactions'} on ${overlap.accountName}.`,
    )
    this.name = 'StatementOverlapError'
  }
}

function required<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new ApiError(`${label} not found`)
  }
  return value
}

const memory = new MemoryLedger()

function memoryClient(): ClientApi {
  const read = () => views(memory.snapshot)
  return {
    getOverview: async () => read().overview,
    getCardsOverview: async () => read().cardsOverview,
    getCards: async () => read().cards,
    getCard: async (id) => required(read().card(id), 'Card'),
    getBanksOverview: async () => read().banksOverview,
    getBanks: async () => read().banks,
    getBank: async (id) => required(read().bank(id), 'Bank account'),
    getInvestmentsOverview: async () => read().investmentsOverview,
    getInvestments: async () => read().investments,
    getInvestment: async (id) => required(read().investment(id), 'Investment account'),
    getBillsOverview: async () => read().billsOverview,
    getUtilities: async () => read().utilities,
    getUtility: async (id) => required(read().utility(id), 'Utility'),
    getInsurance: async () => read().insurance,
    getAccounts: async () => read().accounts,
    getAccount: async (id) => required(read().account(id), 'Account'),
    getBill: async (id) => required(read().bill(id), 'Bill'),
    createAccount: async (input) => memory.createAccount(input),
    updateAccount: async (id, input) => memory.updateAccount(id, input),
    deleteAccount: async (id) => {
      memory.deleteAccount(id)
    },
    createTransaction: async (input) => memory.createTransaction(input),
    deleteTransaction: async (id) => {
      memory.deleteTransaction(id)
    },
    createHolding: async (input) => memory.createHolding(input),
    deleteHolding: async (id) => {
      memory.deleteHolding(id)
    },
    createBill: async (input) => memory.createBill(input),
    updateBill: async (id, input) => memory.updateBill(id, input),
    deleteBill: async (id) => {
      memory.deleteBill(id)
    },
    importCardStatement: async ({ file, confirm }) => {
      const parsed = await parseCardPdf(file)
      const committed = memory.importCardStatement(parsed, confirm)
      if (committed.status === 'overlap') {
        throw new StatementOverlapError(committed.overlap)
      }
      return committed.result
    },
    importBankStatement: async ({ file, confirm }) => {
      const parsed = await parseBankPdf(file)
      const committed = memory.importBankStatement(parsed, confirm)
      if (committed.status === 'overlap') {
        throw new StatementOverlapError(committed.overlap)
      }
      return committed.result
    },
    listChainAddresses: async (accountId) =>
      memory.snapshot.chainAddresses.filter((row) => row.accountId === accountId),
    createChainAddress: async (accountId, input) => memory.createChainAddress({ accountId, ...input }),
    deleteChainAddress: async (_accountId, addressId) => {
      memory.deleteChainAddress(addressId)
    },
    syncChainAddress: async (_accountId, addressId) => memory.syncChainAddress(addressId),
  }
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new ApiError(`${path} failed`, response.status)
  }
  return (await response.json()) as T
}

async function sendJson<T>(baseUrl: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    throw new ApiError(await errorMessage(response, path), response.status)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

async function errorMessage(response: Response, path: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null
  if (typeof payload?.message === 'string' && payload.message) return payload.message
  if (Array.isArray(payload?.message) && payload.message[0]) return payload.message[0]
  return `${path} failed`
}

function liveClient(baseUrl: string): ClientApi {
  const root = baseUrl.replace(/\/$/, '')
  return {
    getOverview: () => getJson(root, '/overview'),
    getCardsOverview: () => getJson(root, '/cards/overview'),
    getCards: () => getJson(root, '/cards'),
    getCard: (id) => getJson(root, `/cards/${id}`),
    getBanksOverview: () => getJson(root, '/banks/overview'),
    getBanks: () => getJson(root, '/banks'),
    getBank: (id) => getJson(root, `/banks/${id}`),
    getInvestmentsOverview: () => getJson(root, '/investments/overview'),
    getInvestments: () => getJson(root, '/investments'),
    getInvestment: (id) => getJson(root, `/investments/${id}`),
    getBillsOverview: () => getJson(root, '/bills/overview'),
    getUtilities: () => getJson(root, '/bills/utilities'),
    getUtility: (id) => getJson(root, `/bills/utilities/${id}`),
    getInsurance: () => getJson(root, '/bills/insurance'),
    getAccounts: () => getJson(root, '/accounts'),
    getAccount: (id) => getJson(root, `/accounts/${id}`),
    getBill: (id) => getJson(root, `/bills/entry/${id}`),
    createAccount: (input) => sendJson(root, 'POST', '/accounts', input),
    updateAccount: (id, input) => sendJson(root, 'PATCH', `/accounts/${id}`, input),
    deleteAccount: (id) => sendJson(root, 'DELETE', `/accounts/${id}`),
    createTransaction: (input) => sendJson(root, 'POST', '/transactions', input),
    deleteTransaction: (id) => sendJson(root, 'DELETE', `/transactions/${id}`),
    createHolding: (input) => sendJson(root, 'POST', '/holdings', input),
    deleteHolding: (id) => sendJson(root, 'DELETE', `/holdings/${id}`),
    createBill: (input) => sendJson(root, 'POST', '/bills', input),
    updateBill: (id, input) => sendJson(root, 'PATCH', `/bills/${id}`, input),
    deleteBill: (id) => sendJson(root, 'DELETE', `/bills/${id}`),
    importCardStatement: (input) => postCardStatement(root, input),
    importBankStatement: (input) => postBankStatement(root, input),
    listChainAddresses: (accountId) => getJson(root, `/accounts/${accountId}/chain-addresses`),
    createChainAddress: (accountId, input) =>
      sendJson(root, 'POST', `/accounts/${accountId}/chain-addresses`, input),
    deleteChainAddress: (accountId, addressId) =>
      sendJson(root, 'DELETE', `/accounts/${accountId}/chain-addresses/${addressId}`),
    syncChainAddress: (accountId, addressId) =>
      sendJson(root, 'POST', `/accounts/${accountId}/chain-addresses/${addressId}/sync`),
  }
}

export function createClient(options: { baseUrl?: string } = {}): ClientApi {
  if (options.baseUrl) {
    return liveClient(options.baseUrl)
  }
  return memoryClient()
}

export function resetMemoryClient() {
  memory.reset()
}

async function parseCardPdf(file: File) {
  const text = await pdfText(file, 'card')
  try {
    return parseCardStatement(text)
  } catch (error) {
    if (error instanceof ParseError) throw new ApiError(error.message, 400)
    throw error
  }
}

async function parseBankPdf(file: File) {
  const text = await pdfText(file, 'bank')
  try {
    return parseBankStatement(text)
  } catch (error) {
    if (error instanceof ParseError) throw new ApiError(error.message, 400)
    throw error
  }
}

async function pdfText(file: File, kind: 'card' | 'bank') {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new ApiError(`Upload a PDF ${kind} statement. CSV parsers are not wired yet.`, 400)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    return await extractPdfText(bytes)
  } catch (error) {
    throw new ApiError(`Couldn't read that PDF (${error instanceof Error ? error.message : 'unknown'})`, 400)
  }
}

async function postCardStatement(
  root: string,
  input: { file: File; confirm?: 'replace' },
): Promise<CardStatementImportResult> {
  const body = new FormData()
  body.append('file', input.file)
  const path = input.confirm === 'replace' ? '/cards/statements?confirm=replace' : '/cards/statements'
  const response = await fetch(`${root}${path}`, { method: 'POST', body })
  const payload = (await response.json().catch(() => null)) as
    | CardStatementImportResult
    | CardStatementOverlap
    | { status?: string; message?: CardStatementOverlap | string }
    | null
  if (response.status === 409) {
    const overlap =
      payload && typeof payload === 'object' && 'overlapCount' in payload
        ? (payload as CardStatementOverlap)
        : payload && typeof payload === 'object' && payload.message && typeof payload.message === 'object'
          ? payload.message
          : null
    if (overlap) throw new StatementOverlapError(overlap)
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.message === 'string'
        ? payload.message
        : `${path} failed`
    throw new ApiError(message, response.status)
  }
  return payload as CardStatementImportResult
}

async function postBankStatement(
  root: string,
  input: { file: File; confirm?: 'replace' },
): Promise<BankStatementImportResult> {
  const body = new FormData()
  body.append('file', input.file)
  const path = input.confirm === 'replace' ? '/banks/statements?confirm=replace' : '/banks/statements'
  const response = await fetch(`${root}${path}`, { method: 'POST', body })
  const payload = (await response.json().catch(() => null)) as
    | BankStatementImportResult
    | BankStatementOverlap
    | { status?: string; message?: BankStatementOverlap | string }
    | null
  if (response.status === 409) {
    const overlap =
      payload && typeof payload === 'object' && 'overlapCount' in payload
        ? (payload as BankStatementOverlap)
        : payload && typeof payload === 'object' && payload.message && typeof payload.message === 'object'
          ? payload.message
          : null
    if (overlap) throw new StatementOverlapError(overlap)
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.message === 'string'
        ? payload.message
        : `${path} failed`
    throw new ApiError(message, response.status)
  }
  return payload as BankStatementImportResult
}

export { ApiError, MemoryLedger }
