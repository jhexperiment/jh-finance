import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { GhostButton, PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { Pill } from '@/components/ui/Pill'
import { Metric } from '@/components/ui/Metric'

export function CardsPage() {
  const overview = useQuery({ queryKey: ['cards-overview'], queryFn: api.getCardsOverview })
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.getCards })
  if (!overview.data || !cards.data) return null

  return (
    <>
      <PageHeader
        title="Credit cards"
        subtitle="October 2026 · 4 cards · 118 transactions"
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Card">
            <PrimaryButton>All cards</PrimaryButton>
            {cards.data.map((card) => (
              <Link key={card.id} to={card.href}>
                <GhostButton>{card.name}</GhostButton>
              </Link>
            ))}
          </div>
        }
      />
      <section className="mt-6 grid grid-cols-3 gap-4">
        <Metric
          label="Spent this month, all cards"
          value={overview.data.spent}
          hint={overview.data.spentHint}
          tone="gain"
          size="lg"
        />
        <Metric
          label="Projected statement totals"
          value={overview.data.projected}
          hint={overview.data.projectedHint}
          size="lg"
        />
        <Metric
          label="Payments due this cycle"
          value={overview.data.due}
          hint={overview.data.dueHint}
          tone="warn"
          size="lg"
        />
      </section>
      <section className="mt-6 grid grid-cols-[1fr_1.6fr] items-start gap-6">
        <Card>
          <h2 className="m-0 text-base font-semibold">Spending by category</h2>
          <p className="mt-1 mb-0 text-[13px] text-muted">Share of October spend, all cards</p>
          <ul className="mt-5 mb-0 grid list-none gap-4 p-0">
            {overview.data.categories.map((category) => (
              <li key={category.label}>
                <div className="flex justify-between text-sm">
                  <span>{category.label}</span>
                  <span className="num">{category.amount}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-chip">
                  <span
                    className="block h-2 rounded-full"
                    style={{ width: `${category.pct}%`, background: category.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl bg-chip p-3.5">
            <p className="m-0 text-[13px] font-semibold">Recurring detected</p>
            <p className="mt-1 mb-0 text-[13px] leading-5 text-muted">
              {overview.data.recurringNote}
            </p>
          </div>
        </Card>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-base font-semibold">Transactions</h2>
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
                  ⌕
                </span>
                <input
                  type="search"
                  placeholder="Search merchants"
                  className="w-[200px] rounded-[10px] border border-line py-2 pr-3 pl-7 font-sans text-sm"
                />
              </label>
              <select
                aria-label="Category"
                className="rounded-[10px] border border-line bg-white px-2.5 py-2 font-sans text-sm"
              >
                <option>All categories</option>
                <option>Groceries</option>
                <option>Dining</option>
                <option>Shopping</option>
                <option>Travel</option>
              </select>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            <Pill tone="loss">1 flagged</Pill>
            <Pill>Pending 2</Pill>
            <Pill>Recurring 8</Pill>
            <Pill>Refunds 1</Pill>
          </div>
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'merchant', label: 'Merchant' },
              { key: 'card', label: 'Card' },
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount', align: 'right' },
            ]}
          >
            {overview.data.transactions.map((row) => (
              <Row key={row.id} flagged={row.flagged}>
                <Cell muted className="num">
                  {row.date}
                </Cell>
                <Cell>
                  {row.flagged ? (
                    <>
                      <strong className="font-semibold">{row.description}</strong>
                      <br />
                      <span className="text-xs text-loss">{row.note}</span>
                    </>
                  ) : (
                    <>
                      {row.description}
                      {row.note ? (
                        <>
                          <br />
                          <span className="text-xs text-muted">{row.note}</span>
                        </>
                      ) : null}
                    </>
                  )}
                </Cell>
                <Cell>{row.account}</Cell>
                <Cell>
                  <Pill>{row.category ?? ''}</Pill>
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
        </Card>
      </section>
    </>
  )
}
