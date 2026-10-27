import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { AllocationLegend } from '@/components/ui/Allocation'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { Metric } from '@/components/ui/Metric'
import { Pill } from '@/components/ui/Pill'

export function InvestmentsPage() {
  const overview = useQuery({
    queryKey: ['investments-overview'],
    queryFn: api.getInvestmentsOverview,
  })
  const accounts = useQuery({ queryKey: ['investments'], queryFn: api.getInvestments })
  if (!overview.data || !accounts.data) return null

  const count = accounts.data.length
  const circumference = 2 * Math.PI * 72
  let offset = 0

  return (
    <>
      <PageHeader
        title="Investments and crypto"
        subtitle={count ? `${count} ${count === 1 ? 'account' : 'accounts'}` : 'No investment accounts yet'}
        actions={<PrimaryButton to="/investments/new">Add account</PrimaryButton>}
      />
      {count === 0 ? (
        <EmptyState
          title="No investment accounts yet"
          body="Add a brokerage, 401(k), or crypto account, then type holdings or upload a statement later."
          action={<PrimaryButton to="/investments/new">Add account</PrimaryButton>}
        />
      ) : (
        <>
          <section className="mt-6 grid grid-cols-3 gap-4">
            <Metric
              label="Total invested"
              value={overview.data.total}
              hint={overview.data.totalHint}
              size="lg"
            />
            <Metric
              label="Total gain, all time"
              value={overview.data.gain}
              hint={overview.data.gainHint}
              tone="gain"
              size="lg"
            />
            <Metric
              label="Crypto, unrealized"
              value={overview.data.cryptoUnrealized}
              hint={overview.data.cryptoHint}
              size="lg"
            />
          </section>
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-base font-semibold">Accounts</h2>
              <Pill>{`${count} linked`}</Pill>
            </div>
            <DataTable
              columns={[
                { key: 'account', label: 'Account' },
                { key: 'type', label: 'Type' },
                { key: 'holdings', label: 'Holdings' },
                { key: 'value', label: 'Value', align: 'right' },
                { key: 'share', label: 'Share', align: 'right' },
              ]}
            >
              {accounts.data.map((account) => (
                <Row key={account.id}>
                  <Cell>
                    <Link to={account.href} className="font-semibold">
                      {account.name}
                    </Link>
                  </Cell>
                  <Cell>{account.typeLabel}</Cell>
                  <Cell>{account.extra}</Cell>
                  <Cell align="right" className="num">
                    {account.value}
                  </Cell>
                  <Cell align="right" className="num">
                    {account.share ?? '—'}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </Card>
          <section className="mt-6 grid grid-cols-[1fr_1.5fr] items-start gap-6">
            <Card>
              <h2 className="m-0 text-base font-semibold">Allocation by account</h2>
              {overview.data.allocation.length > 0 ? (
                <>
                  <div className="mt-5 flex justify-center">
                    <svg
                      viewBox="0 0 200 200"
                      width="200"
                      height="200"
                      role="img"
                      aria-label="Allocation by account"
                    >
                      <g transform="rotate(-90 100 100)" fill="none" strokeWidth="28">
                        {overview.data.allocation.map((slice) => {
                          const length = (slice.pct / 100) * circumference
                          const current = offset
                          offset += length
                          return (
                            <circle
                              key={slice.label}
                              cx="100"
                              cy="100"
                              r="72"
                              stroke={slice.color}
                              strokeDasharray={`${length} ${circumference}`}
                              strokeDashoffset={-current}
                            />
                          )
                        })}
                      </g>
                      <text x="100" y="96" textAnchor="middle" fontSize="13" fill="#5B6270">
                        Invested
                      </text>
                      <text
                        x="100"
                        y="118"
                        textAnchor="middle"
                        fontSize="18"
                        fontWeight="700"
                        fill="#1A1D21"
                      >
                        {overview.data.total.replace('.00', '')}
                      </text>
                    </svg>
                  </div>
                  <AllocationLegend slices={overview.data.allocation} />
                </>
              ) : (
                <p className="mt-4 mb-0 text-sm text-muted">Add account values to see allocation.</p>
              )}
            </Card>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-base font-semibold">Holdings</h2>
              </div>
              {overview.data.holdings.length > 0 ? (
                <DataTable
                  columns={[
                    { key: 'asset', label: 'Asset' },
                    { key: 'account', label: 'Account' },
                    { key: 'value', label: 'Value', align: 'right' },
                    { key: 'gain', label: 'Total gain', align: 'right' },
                  ]}
                >
                  {overview.data.holdings.map((holding) => (
                    <Row key={holding.id}>
                      <Cell>
                        <strong className="font-semibold">{holding.name}</strong>
                        <br />
                        <span className="text-xs text-muted">{holding.detail}</span>
                      </Cell>
                      <Cell>{holding.accountName}</Cell>
                      <Cell align="right" className="num">
                        {holding.value}
                      </Cell>
                      <Cell
                        align="right"
                        className={`num ${holding.totalGainTone === 'gain' ? 'text-gain' : holding.totalGainTone === 'loss' ? 'text-loss' : ''}`}
                      >
                        {holding.totalGain}
                      </Cell>
                    </Row>
                  ))}
                </DataTable>
              ) : (
                <p className="mt-4 mb-0 text-sm text-muted">No holdings yet. Open an account to add one.</p>
              )}
              <div className="mt-5 rounded-xl bg-chip p-3.5">
                <p className="m-0 text-[13px] font-semibold">{overview.data.callout.title}</p>
                <p className="mt-1 mb-0 text-[13px] leading-5 text-muted">
                  {overview.data.callout.body}
                </p>
              </div>
            </Card>
          </section>
        </>
      )}
    </>
  )
}
