import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createClient, resetMemoryClient } from 'client-api-sdk'
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
})
