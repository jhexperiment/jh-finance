import { dexMatchesForHoldings, dexUnsupportedHoldings, type Holding } from 'shared'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'

export function DexVenues({ holdings }: { holdings: Holding[] }) {
  const matches = dexMatchesForHoldings(holdings)
  const unsupported = dexUnsupportedHoldings(holdings)

  return (
    <Card className="mt-6">
      <h2 className="m-0 text-base font-semibold">Decentralized exchanges</h2>
      <p className="mt-1.5 mb-0 text-sm text-muted">
        Venues that can swap these on-chain holdings. JH Finance does not place trades.
      </p>
      {matches.length > 0 ? (
        <DataTable
          columns={[
            { key: 'exchange', label: 'Exchange' },
            { key: 'holdings', label: 'Holdings' },
          ]}
        >
          {matches.map((match) => (
            <Row key={match.venue.id}>
              <Cell className="w-[260px] align-top">
                <a
                  href={match.venue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-accent no-underline"
                >
                  {match.venue.name}
                </a>
                <div className="mt-1 text-muted">{match.networks.join(', ')}</div>
                <div className="mt-0.5 text-muted">{match.venue.summary}</div>
              </Cell>
              <Cell className="align-top">
                <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-muted">
                  {[...new Set(match.assets.map((asset) => asset.symbol))].map((symbol) => (
                    <li key={`${match.venue.id}:${symbol}`}>{symbol}</li>
                  ))}
                </ul>
              </Cell>
            </Row>
          ))}
        </DataTable>
      ) : unsupported.length === 0 ? (
        <p className="mt-4 mb-0 text-sm text-muted">
          No holdings on a supported DEX yet. Ethereum, BNB Smart Chain, XRP, and Stellar
          assets can appear here.
        </p>
      ) : null}
      {unsupported.length > 0 ? (
        <p className="mt-4 mb-0 text-sm text-muted">
          {unsupportedNetworkCopy(unsupported.map((row) => row.chainLabel))} not listed —
          they do not trade on these DEXes.
        </p>
      ) : null}
    </Card>
  )
}

function unsupportedNetworkCopy(labels: string[]): string {
  const unique = [...new Set(labels)]
  if (unique.length === 1) return `${unique[0]} balances are`
  if (unique.length === 2) return `${unique[0]} and ${unique[1]} balances are`
  return `${unique.slice(0, -1).join(', ')}, and ${unique.at(-1)} balances are`
}
