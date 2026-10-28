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
