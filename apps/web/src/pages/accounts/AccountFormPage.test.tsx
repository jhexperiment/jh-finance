import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createClient, resetMemoryClient } from 'client-api-sdk'
import { AccountFormPage } from './AccountFormPage'

const api = createClient()

function wrap(ui: ReactElement, path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/investments/new" element={ui} />
          <Route path="/investments/:id/edit" element={ui} />
          <Route path="/investments/:id" element={<div>account detail</div>} />
          <Route path="/investments" element={<div>investments list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AccountFormPage investments', () => {
  beforeEach(() => {
    resetMemoryClient()
  })

  it('matches the investment add form: type follows kind, optional chain watch, no last four', () => {
    render(wrap(<AccountFormPage section="investments" />, '/investments/new'))
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByLabelText('Kind')).toBeTruthy()
    expect(screen.getByText('Types follow the kind: Investment or Crypto.')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Brokerage' })).toBeTruthy()
    expect(screen.queryByText('Last four')).toBeNull()
    expect(screen.queryByLabelText('Balance')).toBeNull()
    expect(screen.queryByText('Watched addresses')).toBeNull()

    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'crypto' } })
    const type = screen.getByRole('combobox', { name: /Type/ }) as HTMLSelectElement
    expect(type.value).toBe('Wallet')
    expect([...type.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'Wallet',
      'Exchange',
    ])
    expect(screen.getByLabelText('Chain')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Bitcoin' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Stellar' })).toBeTruthy()
    expect(screen.getByText('Watched addresses')).toBeTruthy()
    expect(screen.getByLabelText('Watch 1')).toBeTruthy()
    expect(screen.getByLabelText('Watch 2')).toBeTruthy()
    expect(screen.getByLabelText('Watch 3')).toBeTruthy()
    expect(screen.getByPlaceholderText('xpub… (legacy 1…)')).toBeTruthy()
    expect(screen.getByPlaceholderText('zpub… (SegWit bc1q…)')).toBeTruthy()
    expect(screen.getByPlaceholderText('zpub… (Taproot bc1p…)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add another watch' }))
    expect(screen.getByLabelText('Watch 4')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[3])
    expect(screen.queryByLabelText('Watch 4')).toBeNull()

    fireEvent.change(screen.getByLabelText('Chain'), { target: { value: 'eth' } })
    expect(screen.queryByText('Watched addresses')).toBeNull()
    expect(screen.queryByLabelText('Watch 2')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add another watch' })).toBeNull()
    expect(screen.getByLabelText('Watch address')).toBeTruthy()
    expect(screen.getByPlaceholderText('0x…')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Chain'), { target: { value: 'btc' } })
    expect(screen.getByText('Watched addresses')).toBeTruthy()
    expect(screen.getByLabelText('Watch 2')).toBeTruthy()
    expect(screen.getByLabelText('Watch 3')).toBeTruthy()
  })

  it('saves separate Bitcoin watches on one crypto account', async () => {
    render(wrap(<AccountFormPage section="investments" />, '/investments/new'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Cold wallet' } })
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'crypto' } })
    fireEvent.change(screen.getByPlaceholderText('xpub… (legacy 1…)'), {
      target: { value: 'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj' },
    })
    fireEvent.change(screen.getByPlaceholderText('zpub… (SegWit bc1q…)'), {
      target: { value: 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))
    expect(await screen.findByText('account detail')).toBeTruthy()
    const created = (await api.getAccounts()).find((row) => row.name === 'Cold wallet')
    expect(created?.kind).toBe('crypto')
    expect(created?.typeLabel).toBe('Wallet')
    const watched = await api.listChainAddresses(created!.id)
    expect(watched).toHaveLength(2)
    expect(watched.map((row) => row.chain)).toEqual(['btc', 'btc'])
    expect(watched.map((row) => row.address)).toEqual([
      'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
    ])
  })
})
