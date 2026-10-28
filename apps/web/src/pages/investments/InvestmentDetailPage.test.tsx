import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { createClient, resetMemoryClient } from 'client-api-sdk'
import { api as liveApi } from '@/api/client'
import { InvestmentDetailPage } from './InvestmentDetailPage'

const api = createClient()

function wrap(ui: ReactElement, path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/investments/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('InvestmentDetailPage crypto addresses', () => {
  beforeEach(() => {
    resetMemoryClient()
    vi.restoreAllMocks()
  })

  it('lets a crypto account watch a public address', async () => {
    const account = await api.createAccount({ name: 'Cold wallet', kind: 'crypto' })
    render(wrap(<InvestmentDetailPage />, `/investments/${account.id}`))
    expect(await screen.findByText('Watched addresses')).toBeTruthy()
    expect(screen.getByText(/Public receive addresses or HD xpub/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('bc1q…, xpub…, or zpub…'), {
      target: { value: '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Watch address' }))
    expect(await screen.findByText('1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fetch transactions' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy address' })).toBeTruthy()
    expect(screen.getByText('1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv').className).toMatch(/truncate/)
  })

  it('copies a watched address and shows the full key on hover', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const account = await api.createAccount({ name: 'Cold wallet', kind: 'crypto' })
    const xpub =
      'xpub6Bio1js6vQQD89kFTBc7c2vcF5pnjnbmKhyMNKXkEEgh48Yjo39E3ZshRmUC4GwDoFNsSQPSgPNH7RGyh6qCwAzbABo8ZhbDh4UDtTjVEBA'
    render(wrap(<InvestmentDetailPage />, `/investments/${account.id}`))
    expect(await screen.findByText('Watched addresses')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('bc1q…, xpub…, or zpub…'), {
      target: { value: xpub },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Watch address' }))
    const text = await screen.findByText(xpub)
    fireEvent.mouseEnter(text)
    expect(screen.getByRole('tooltip').textContent).toBe(xpub)
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(writeText).toHaveBeenCalledWith(xpub)
    expect(await screen.findByTitle('Copied')).toBeTruthy()
  })

  it('keeps Fetching… after navigating away and back', async () => {
    const account = await api.createAccount({ name: 'Cold wallet', kind: 'crypto' })
    vi.spyOn(liveApi, 'syncChainAddress').mockReturnValue(new Promise(() => {}))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/investments/${account.id}`]}>
          <Routes>
            <Route path="/investments/:id" element={<InvestmentDetailPage />} />
            <Route
              path="/investments"
              element={<Link to={`/investments/${account.id}`}>investments list</Link>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Watched addresses')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('bc1q…, xpub…, or zpub…'), {
      target: { value: '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Watch address' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fetch transactions' }))
    expect(await screen.findByRole('button', { name: 'Fetching…' })).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Crypto' }))
    expect(await screen.findByText('investments list')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'investments list' }))
    expect(await screen.findByRole('button', { name: 'Fetching…' })).toBeTruthy()
  })

  it('shows native holding total instead of USD on the value tile', async () => {
    const account = await api.createAccount({ name: 'Cold wallet', kind: 'crypto' })
    await api.createTransaction({
      accountId: account.id,
      postedAt: '2017-05-22',
      description: 'Received',
      amount: '1.5',
      asset: 'BTC',
    })
    await api.createTransaction({
      accountId: account.id,
      postedAt: '2017-05-23',
      description: 'Sent',
      amount: '-0.25',
      asset: 'BTC',
    })
    render(wrap(<InvestmentDetailPage />, `/investments/${account.id}`))
    expect(await screen.findByText('1.25 BTC')).toBeTruthy()
    expect(screen.queryByText('$0.00')).toBeNull()
  })

  it('shows the year on activity dates outside the current year', async () => {
    const account = await api.createAccount({ name: 'Cold wallet', kind: 'crypto' })
    const year = new Date().getFullYear()
    await api.createTransaction({
      accountId: account.id,
      postedAt: '2017-05-22',
      description: 'Old receive',
      amount: '0.10',
    })
    await api.createTransaction({
      accountId: account.id,
      postedAt: `${year}-05-22`,
      description: 'This year',
      amount: '0.20',
    })
    render(wrap(<InvestmentDetailPage />, `/investments/${account.id}`))
    expect(await screen.findByText('Old receive')).toBeTruthy()
    expect(screen.getByText('May 22, 2017')).toBeTruthy()
    expect(screen.getByText('May 22')).toBeTruthy()
  })
})

describe('InvestmentDetailPage migrate', () => {
  beforeEach(() => {
    resetMemoryClient()
  })

  it('asks you to add a matching account when none exist', async () => {
    const account = await api.createAccount({ name: 'Cold wallet', kind: 'crypto', subtype: 'Wallet' })
    render(wrap(<InvestmentDetailPage />, `/investments/${account.id}`))
    expect(await screen.findByRole('button', { name: 'Migrate' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Migrate' }))
    expect(await screen.findByText('Migrate to another account')).toBeTruthy()
    expect(screen.getByText(/Both accounts must be Crypto · Wallet/)).toBeTruthy()
    expect(
      await screen.findByText('There is no other Wallet account to move into yet. Add one first.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Migrate to another account')).toBeNull()
  })

  it('only lists another account of the same kind and type', async () => {
    const source = await api.createAccount({ name: 'Cold wallet', kind: 'crypto', subtype: 'Wallet' })
    await api.createAccount({ name: 'Keep wallet', kind: 'crypto', subtype: 'Wallet' })
    await api.createAccount({ name: 'Exchange', kind: 'crypto', subtype: 'Exchange' })
    await api.createAccount({ name: 'Brokerage', kind: 'investment', subtype: 'Brokerage' })
    render(wrap(<InvestmentDetailPage />, `/investments/${source.id}`))
    fireEvent.click(await screen.findByRole('button', { name: 'Migrate' }))
    expect(await screen.findByLabelText('Move into')).toBeTruthy()
    const options = [...screen.getByLabelText('Move into').querySelectorAll('option')].map(
      (option) => option.textContent,
    )
    expect(options).toEqual(['Keep wallet'])
  })

  it('moves holdings, activity, and unique watched addresses then removes the source', async () => {
    const source = await api.createAccount({ name: 'Cold wallet', kind: 'crypto', subtype: 'Wallet' })
    const dest = await api.createAccount({ name: 'Keep wallet', kind: 'crypto', subtype: 'Wallet' })
    await api.createHolding({
      accountId: source.id,
      name: 'Bitcoin',
      symbol: 'BTC',
      quantity: '1.25',
      value: '100.00',
    })
    await api.createTransaction({
      accountId: source.id,
      postedAt: '2017-05-22',
      description: 'Received',
      amount: '0.10',
    })
    await api.createChainAddress(source.id, {
      chain: 'btc',
      address: '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv',
    })
    await api.createChainAddress(source.id, {
      chain: 'btc',
      address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    })
    await api.createChainAddress(dest.id, {
      chain: 'btc',
      address: '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv',
    })
    render(wrap(<InvestmentDetailPage />, `/investments/${source.id}`))
    fireEvent.click(await screen.findByRole('button', { name: 'Migrate' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Migrate and remove this account' }))
    expect(
      await screen.findByText(
        'Moved 1 holdings, 1 activity lines, and 1 watched addresses from Cold wallet (1 already watched, skipped). Cold wallet was removed.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Keep wallet' })).toBeTruthy()
    expect(screen.getByText('Received')).toBeTruthy()
    expect(screen.getByText('1.25 BTC')).toBeTruthy()
    expect(screen.getByText('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBeTruthy()
    expect(screen.getAllByText('1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv')).toHaveLength(1)
    await expect(api.getInvestment(source.id)).rejects.toThrow()
  })
})
