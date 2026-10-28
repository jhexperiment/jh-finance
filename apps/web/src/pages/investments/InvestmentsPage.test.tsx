import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { createClient, resetMemoryClient } from 'client-api-sdk'
import { InvestmentsPage } from './InvestmentsPage'

const api = createClient()

function wrap(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('InvestmentsPage accounts', () => {
  beforeEach(() => {
    resetMemoryClient()
  })

  it('shows holding count and native totals from recorded crypto activity', async () => {
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
    render(wrap(<InvestmentsPage />))
    expect(await screen.findByText('Cold wallet')).toBeTruthy()
    expect(screen.getByText('1 holding')).toBeTruthy()
    expect(screen.getByText('1.25 BTC')).toBeTruthy()
  })
})
