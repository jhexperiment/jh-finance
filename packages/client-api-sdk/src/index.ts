import {
  banks,
  banksOverview,
  billsOverview,
  cards,
  cardsOverview,
  findBank,
  findCard,
  findInvestment,
  findUtility,
  insurance,
  investments,
  investmentsOverview,
  overview,
  utilities,
  type BankAccount,
  type BanksOverview,
  type BillsOverview,
  type CardAccount,
  type CardsOverview,
  type InsurancePolicy,
  type InvestmentAccount,
  type InvestmentsOverview,
  type OverviewSnapshot,
  type UtilityAccount,
} from 'shared'

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

function required<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new ApiError(`${label} not found`)
  }
  return value
}

const fixtureClient: ClientApi = {
  getOverview: async () => overview,
  getCardsOverview: async () => cardsOverview,
  getCards: async () => cards,
  getCard: async (id) => required(findCard(id), 'Card'),
  getBanksOverview: async () => banksOverview,
  getBanks: async () => banks,
  getBank: async (id) => required(findBank(id), 'Bank account'),
  getInvestmentsOverview: async () => investmentsOverview,
  getInvestments: async () => investments,
  getInvestment: async (id) => required(findInvestment(id), 'Investment account'),
  getBillsOverview: async () => billsOverview,
  getUtilities: async () => utilities,
  getUtility: async (id) => required(findUtility(id), 'Utility'),
  getInsurance: async () => insurance,
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new ApiError(`${path} failed`, response.status)
  }
  return (await response.json()) as T
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
  }
}

export function createClient(options: { baseUrl?: string } = {}): ClientApi {
  if (options.baseUrl) {
    return liveClient(options.baseUrl)
  }
  return fixtureClient
}

export { ApiError }
