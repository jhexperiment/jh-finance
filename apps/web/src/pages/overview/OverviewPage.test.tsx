import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { resetMemoryClient } from 'client-api-sdk'
import { OverviewPage } from './OverviewPage'

function wrap(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OverviewPage', () => {
  beforeEach(() => {
    resetMemoryClient()
  })

  it('renders an empty workspace', async () => {
    render(wrap(<OverviewPage />))
    expect(await screen.findByText('No accounts yet')).toBeTruthy()
    expect(screen.getByText('Net worth, all accounts')).toBeTruthy()
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Needs attention')).toBeTruthy()
  })
})
