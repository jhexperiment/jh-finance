import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatementUpload } from '@/components/ledger/StatementUpload'
import { GhostButton, PageHeader } from '@/components/ui/PageHeader'
import { Metric } from '@/components/ui/Metric'
import { Pill } from '@/components/ui/Pill'
import { StatusPill } from '@/components/ui/Status'

export function StatementsPage() {
  const overview = useQuery({ queryKey: ['banks-overview'], queryFn: api.getBanksOverview })
  const banks = useQuery({ queryKey: ['banks'], queryFn: api.getBanks })
  if (!overview.data || !banks.data) return null

  const count = banks.data.length

  return (
    <>
      <PageHeader
        title="Bank statements"
        subtitle={count ? `${count} ${count === 1 ? 'account' : 'accounts'}` : 'No bank accounts yet'}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatementUpload kind="bank" />
            <GhostButton to="/statements/new">Add bank account</GhostButton>
          </div>
        }
      />
      {count === 0 ? (
        <EmptyState
          title="No bank accounts yet"
          body="Upload a Bank of Hawaii PDF and we’ll add the checking and savings accounts from the statement, or add an account by hand."
          action={
            <div className="flex flex-wrap gap-2">
              <StatementUpload kind="bank" />
              <GhostButton to="/statements/new">Add bank account</GhostButton>
            </div>
          }
        />
      ) : (
        <>
          <section className="mt-6 grid grid-cols-4 gap-4">
            <Metric
              label="Total balance"
              value={overview.data.total}
              hint={`${count} ${count === 1 ? 'account' : 'accounts'}`}
            />
            <Metric label="Income recorded" value={overview.data.income} hint="Credits" tone="gain" />
            <Metric label="Spending recorded" value={overview.data.spending} hint="Debits" />
            <Metric
              label="Savings rate"
              value={overview.data.savingsRate}
              hint={overview.data.savingsHint}
              tone="gain"
            />
          </section>
          <section className="mt-6 grid grid-cols-[1.2fr_1fr] items-start gap-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-base font-semibold">Income vs. spending</h2>
                <div className="flex gap-3.5 text-[13px] text-muted">
                  <span>
                    <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-accent" />
                    Income
                  </span>
                  <span>
                    <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-silver" />
                    Spending
                  </span>
                </div>
              </div>
              {overview.data.pairSeries.length > 0 ? (
                <svg
                  viewBox="0 0 600 220"
                  width="100%"
                  height="220"
                  role="img"
                  aria-label="Monthly income and spending"
                  className="mt-5 block"
                >
                  <g stroke="#E3E1D9">
                    <line x1="0" y1="20" x2="600" y2="20" />
                    <line x1="0" y1="90" x2="600" y2="90" />
                    <line x1="0" y1="160" x2="600" y2="160" />
                  </g>
                  {overview.data.pairSeries.map((point, index) => {
                    const x = 20 + index * 100
                    return (
                      <g key={point.label}>
                        <rect
                          x={x}
                          y={160 - point.income}
                          width="28"
                          height={point.income}
                          rx="4"
                          fill="#0E6B63"
                        />
                        <rect
                          x={x + 32}
                          y={160 - point.spending}
                          width="28"
                          height={point.spending}
                          rx="4"
                          fill="#B9BEC8"
                        />
                        <text
                          x={x + 30}
                          y="184"
                          textAnchor="middle"
                          fontSize="12"
                          fill="#5B6270"
                        >
                          {point.label}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              ) : (
                <p className="mt-4 mb-0 text-sm text-muted">No monthly history yet.</p>
              )}
            </Card>
            <Card>
              <h2 className="m-0 text-base font-semibold">Where the money went</h2>
              {overview.data.outflows.length > 0 ? (
                <ul className="mt-[18px] mb-0 grid list-none gap-3.5 p-0 text-sm">
                  {overview.data.outflows.map((row) => (
                    <li key={row.label} className="flex justify-between">
                      <span>{row.label}</span>
                      <span className={`num ${row.tone === 'gain' ? 'text-gain' : ''}`}>
                        {row.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 mb-0 text-sm text-muted">No outflows recorded.</p>
              )}
            </Card>
          </section>
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-base font-semibold">Bank accounts</h2>
              <Pill>{`${count} linked`}</Pill>
            </div>
            <DataTable
              columns={[
                { key: 'account', label: 'Account' },
                { key: 'type', label: 'Type' },
                { key: 'activity', label: 'Last activity' },
                { key: 'statement', label: 'Statement' },
                { key: 'balance', label: 'Balance', align: 'right' },
              ]}
            >
              {banks.data.map((bank) => (
                <Row key={bank.id}>
                  <Cell>
                    <Link to={bank.href} className="font-semibold">
                      {bank.name}
                    </Link>
                  </Cell>
                  <Cell>{bank.typeLabel}</Cell>
                  <Cell muted className="num">
                    {bank.lastActivity}
                  </Cell>
                  <Cell>
                    <StatusPill status={bank.statementStatus} />
                  </Cell>
                  <Cell align="right" className="num">
                    {bank.balance}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </Card>
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-base font-semibold">Parsed statement lines</h2>
            </div>
            {overview.data.lines.length > 0 ? (
              <DataTable
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'description', label: 'Description' },
                  { key: 'match', label: 'Match' },
                  { key: 'amount', label: 'Amount', align: 'right' },
                ]}
              >
                {overview.data.lines.map((row) => (
                  <Row key={row.id}>
                    <Cell muted className="num">
                      {row.date}
                    </Cell>
                    <Cell>{row.description}</Cell>
                    <Cell>
                      <StatusPill status={row.category ?? ''} />
                    </Cell>
                    <Cell
                      align="right"
                      className={`num ${row.amountTone === 'gain' ? 'text-gain' : ''}`}
                    >
                      {row.amount}
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            ) : (
              <p className="mt-4 mb-0 text-sm text-muted">No lines yet. Open an account to add activity.</p>
            )}
          </Card>
        </>
      )}
    </>
  )
}
