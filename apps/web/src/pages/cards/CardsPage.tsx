import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatementUpload } from '@/components/ledger/StatementUpload'
import { GhostButton, PageHeader } from '@/components/ui/PageHeader'
import { Pill } from '@/components/ui/Pill'
import { Metric } from '@/components/ui/Metric'

export function CardsPage() {
  const overview = useQuery({ queryKey: ['cards-overview'], queryFn: api.getCardsOverview })
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.getCards })
  if (!overview.data || !cards.data) return null

  const count = cards.data.length
  const flagged = overview.data.transactions.filter((row) => row.flagged).length

  return (
    <>
      <PageHeader
        title="Credit cards"
        subtitle={count ? `${count} ${count === 1 ? 'card' : 'cards'}` : 'No cards yet'}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatementUpload />
            <GhostButton to="/cards/new">Add card</GhostButton>
          </div>
        }
      />
      {count === 0 ? (
        <EmptyState
          title="No cards yet"
          body="Upload a Chase, Amex, or Citi PDF and we’ll add the card from the last digits, or add a card by hand."
          action={
            <div className="flex flex-wrap gap-2">
              <StatementUpload />
              <GhostButton to="/cards/new">Add card</GhostButton>
            </div>
          }
        />
      ) : (
        <>
          {count > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Card">
              <GhostButton>All cards</GhostButton>
              {cards.data.map((card) => (
                <GhostButton key={card.id} to={card.href}>
                  {card.name}
                </GhostButton>
              ))}
            </div>
          ) : null}
          <section className="mt-6 grid grid-cols-3 gap-4">
            <Metric
              label="Spent this month, all cards"
              value={overview.data.spent}
              hint={overview.data.spentHint}
              size="lg"
            />
            <Metric
              label="Recorded balances"
              value={overview.data.projected}
              hint={overview.data.projectedHint}
              size="lg"
            />
            <Metric
              label="Card balances"
              value={overview.data.due}
              hint={overview.data.dueHint}
              tone="warn"
              size="lg"
            />
          </section>
          <section className="mt-6 grid grid-cols-[1fr_1.6fr] items-start gap-6">
            <Card>
              <h2 className="m-0 text-base font-semibold">Spending by category</h2>
              {overview.data.categories.length > 0 ? (
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
              ) : (
                <p className="mt-4 mb-0 text-sm text-muted">No categorized spend yet.</p>
              )}
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
              </div>
              {flagged > 0 ? (
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  <Pill tone="loss">{`${flagged} flagged`}</Pill>
                </div>
              ) : null}
              {overview.data.transactions.length > 0 ? (
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
                        {row.description}
                        {row.note ? (
                          <>
                            <br />
                            <span className="text-xs text-muted">{row.note}</span>
                          </>
                        ) : null}
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
              ) : (
                <p className="mt-4 mb-0 text-sm text-muted">No card activity yet. Open a card to add a charge.</p>
              )}
            </Card>
          </section>
        </>
      )}
    </>
  )
}
