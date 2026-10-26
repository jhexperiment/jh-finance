import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
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
  it('renders net worth from fixtures', async () => {
    render(wrap(<OverviewPage />))
    expect(await screen.findByText('$248,410.52')).toBeTruthy()
    expect(screen.getByText('Needs attention')).toBeTruthy()
  })
})
