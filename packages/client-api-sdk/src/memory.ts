import {
  applyCreateAccount,
  applyCreateBill,
  applyCreateChainAddress,
  applyCreateHolding,
  applyCreateTransaction,
  applyDeleteChainAddress,
  applyUpdateAccount,
  applyUpdateBill,
  commitBankStatement,
  commitCardStatement,
  commitChainTransactions,
  emptyLedger,
  fetchAddressTransactions,
  projectAccounts,
  projectBanks,
  projectBanksOverview,
  projectBillsOverview,
  projectCards,
  projectCardsOverview,
  projectInsurance,
  projectInvestment,
  projectInvestments,
  projectInvestmentsOverview,
  projectOverview,
  projectUtilities,
  projectUtility,
  type Chain,
  type CreateAccountInput,
  type CreateBillInput,
  type CreateChainAddressInput,
  type CreateHoldingInput,
  type CreateTransactionInput,
  type LedgerSnapshot,
  type ParsedBankStatement,
  type ParsedCardStatement,
  type UpdateAccountInput,
  type UpdateBillInput,
} from 'shared'

export class MemoryLedger {
  snapshot: LedgerSnapshot = emptyLedger()

  reset() {
    this.snapshot = emptyLedger()
  }

  clone(): LedgerSnapshot {
    return {
      accounts: this.snapshot.accounts.map((row) => ({ ...row })),
      transactions: this.snapshot.transactions.map((row) => ({ ...row })),
      holdings: this.snapshot.holdings.map((row) => ({ ...row })),
      bills: this.snapshot.bills.map((row) => ({ ...row })),
      chainAddresses: this.snapshot.chainAddresses.map((row) => ({ ...row })),
    }
  }

  createAccount(input: CreateAccountInput) {
    return applyCreateAccount(this.snapshot, input)
  }

  updateAccount(id: string, input: UpdateAccountInput) {
    const account = this.snapshot.accounts.find((row) => row.id === id)
    if (!account) throw notFound('Account')
    return applyUpdateAccount(account, input)
  }

  deleteAccount(id: string) {
    const exists = this.snapshot.accounts.some((row) => row.id === id)
    if (!exists) throw notFound('Account')
    this.snapshot.accounts = this.snapshot.accounts.filter((row) => row.id !== id)
    this.snapshot.transactions = this.snapshot.transactions.filter((row) => row.accountId !== id)
    this.snapshot.holdings = this.snapshot.holdings.filter((row) => row.accountId !== id)
    this.snapshot.chainAddresses = this.snapshot.chainAddresses.filter((row) => row.accountId !== id)
    this.snapshot.bills = this.snapshot.bills.map((row) =>
      row.paidFromId === id ? { ...row, paidFromId: null } : row,
    )
  }

  createTransaction(input: CreateTransactionInput) {
    this.requireAccount(input.accountId)
    return applyCreateTransaction(this.snapshot, input)
  }

  deleteTransaction(id: string) {
    const exists = this.snapshot.transactions.some((row) => row.id === id)
    if (!exists) throw notFound('Transaction')
    this.snapshot.transactions = this.snapshot.transactions.filter((row) => row.id !== id)
  }

  createHolding(input: CreateHoldingInput) {
    this.requireAccount(input.accountId)
    return applyCreateHolding(this.snapshot, input)
  }

  deleteHolding(id: string) {
    const exists = this.snapshot.holdings.some((row) => row.id === id)
    if (!exists) throw notFound('Holding')
    this.snapshot.holdings = this.snapshot.holdings.filter((row) => row.id !== id)
  }

  createBill(input: CreateBillInput) {
    if (input.paidFromId) this.requireAccount(input.paidFromId)
    return applyCreateBill(this.snapshot, input)
  }

  updateBill(id: string, input: UpdateBillInput) {
    const bill = this.snapshot.bills.find((row) => row.id === id)
    if (!bill) throw notFound('Bill')
    if (input.paidFromId) this.requireAccount(input.paidFromId)
    return applyUpdateBill(bill, input)
  }

  deleteBill(id: string) {
    const exists = this.snapshot.bills.some((row) => row.id === id)
    if (!exists) throw notFound('Bill')
    this.snapshot.bills = this.snapshot.bills.filter((row) => row.id !== id)
  }

  importCardStatement(parsed: ParsedCardStatement, confirm?: 'replace') {
    return commitCardStatement(this.snapshot, parsed, { confirm })
  }

  importBankStatement(parsed: ParsedBankStatement, confirm?: 'replace') {
    return commitBankStatement(this.snapshot, parsed, { confirm })
  }

  createChainAddress(input: CreateChainAddressInput) {
    const account = this.snapshot.accounts.find((row) => row.id === input.accountId)
    if (!account) throw notFound('Account')
    if (account.kind !== 'crypto') {
      const error = new Error('Chain addresses can only be added to a crypto account.')
      error.name = 'ApiError'
      throw error
    }
    return applyCreateChainAddress(this.snapshot, input)
  }

  deleteChainAddress(id: string) {
    const exists = this.snapshot.chainAddresses.some((row) => row.id === id)
    if (!exists) throw notFound('Watched address')
    applyDeleteChainAddress(this.snapshot, id)
  }

  async syncChainAddress(id: string) {
    const watched = this.snapshot.chainAddresses.find((row) => row.id === id)
    if (!watched) throw notFound('Watched address')
    const txs = await fetchAddressTransactions({
      chain: watched.chain as Chain,
      address: watched.address,
      delayMs: 0,
    })
    const committed = commitChainTransactions(this.snapshot, watched.accountId, watched.id, txs)
    return {
      addressId: watched.id,
      chain: watched.chain,
      address: watched.address,
      fetchedCount: committed.fetchedCount,
      importedCount: committed.importedCount,
      skippedCount: committed.skippedCount,
    }
  }

  private requireAccount(id: string) {
    if (!this.snapshot.accounts.some((row) => row.id === id)) throw notFound('Account')
  }
}

function notFound(label: string): Error {
  const error = new Error(`${label} not found`)
  error.name = 'ApiError'
  return error
}

export function views(snapshot: LedgerSnapshot) {
  return {
    overview: projectOverview(snapshot),
    cardsOverview: projectCardsOverview(snapshot),
    cards: projectCards(snapshot),
    banksOverview: projectBanksOverview(snapshot),
    banks: projectBanks(snapshot),
    investmentsOverview: projectInvestmentsOverview(snapshot),
    investments: projectInvestments(snapshot),
    billsOverview: projectBillsOverview(snapshot),
    utilities: projectUtilities(snapshot),
    insurance: projectInsurance(snapshot),
    accounts: projectAccounts(snapshot),
    card: (id: string) => projectCards(snapshot).find((row) => row.id === id),
    bank: (id: string) => projectBanks(snapshot).find((row) => row.id === id),
    investment: (id: string) => {
      const account = snapshot.accounts.find(
        (row) => row.id === id && (row.kind === 'investment' || row.kind === 'crypto'),
      )
      return account ? projectInvestment(account, snapshot) : undefined
    },
    utility: (id: string) => {
      const bill = snapshot.bills.find((row) => row.id === id && row.kind === 'utility')
      return bill ? projectUtility(bill, snapshot) : undefined
    },
    bill: (id: string) => snapshot.bills.find((row) => row.id === id),
    account: (id: string) => snapshot.accounts.find((row) => row.id === id),
  }
}
