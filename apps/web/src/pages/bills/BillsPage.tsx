import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { Metric } from '@/components/ui/Metric'
import { Pill } from '@/components/ui/Pill'
import { StatusPill } from '@/components/ui/Status'

export function BillsPage() {
  const overview = useQuery({ queryKey: ['bills-overview'], queryFn: api.getBillsOverview })
  const utilities = useQuery({ queryKey: ['utilities'], queryFn: api.getUtilities })
  const insurance = useQuery({ queryKey: ['insurance'], queryFn: api.getInsurance })
  if (!overview.data || !utilities.data || !insurance.data) return null

  const empty = utilities.data.length === 0 && insurance.data.length === 0

  return (
    <>
      <PageHeader
        title="Bills and insurance"
        subtitle={
          empty
            ? 'No bills yet'
            : `${utilities.data.length} ${utilities.data.length === 1 ? 'utility' : 'utilities'}, ${insurance.data.length} insurance`
        }
        actions={<PrimaryButton to="/bills/new">Add bill</PrimaryButton>}
      />
      {empty ? (
        <EmptyState
          title="No bills yet"
          body="Add a utility or insurance policy. Utilities get a detail page; insurance stays as a summary card."
          action={<PrimaryButton to="/bills/new">Add bill</PrimaryButton>}
        />
      ) : (
        <>
          <section className="mt-6 grid grid-cols-4 gap-4">
            <Metric
              label="Utilities, monthly"
              value={overview.data.utilitiesMonthly}
              hint={`${utilities.data.length} ${utilities.data.length === 1 ? 'service' : 'services'}`}
            />
            <Metric
              label="Insurance, monthly"
              value={overview.data.insuranceMonthly}
              hint={`${insurance.data.length} ${insurance.data.length === 1 ? 'policy' : 'policies'}`}
            />
            <Metric
              label="Due in next 10 days"
              value={overview.data.dueSoon}
              hint={overview.data.dueSoonHint}
              tone="warn"
            />
            <Metric
              label="Next renewal"
              value={overview.data.nextRenewal}
              hint={overview.data.nextRenewalHint}
            />
          </section>
          <section className="mt-6 grid grid-cols-[1.6fr_1fr] items-start gap-6">
            <Card>
              <h2 className="m-0 text-base font-semibold">Utilities</h2>
              {utilities.data.length > 0 ? (
                <DataTable
                  columns={[
                    { key: 'service', label: 'Service' },
                    { key: 'paid', label: 'Paid from' },
                    { key: 'due', label: 'Next due' },
                    { key: 'status', label: 'Status' },
                    { key: 'bill', label: 'Last bill', align: 'right' },
                  ]}
                >
                  {utilities.data.map((utility) => (
                    <Row key={utility.id}>
                      <Cell>
                        <Link to={utility.href} className="font-semibold">
                          {utility.name}
                        </Link>
                        <br />
                        <span className="text-xs text-muted">{utility.subtitle}</span>
                      </Cell>
                      <Cell>{utility.paidFrom}</Cell>
                      <Cell className="num">{utility.nextDue}</Cell>
                      <Cell>
                        <StatusPill status={utility.status} />
                      </Cell>
                      <Cell align="right" className="num">
                        {utility.lastBill}
                      </Cell>
                    </Row>
                  ))}
                </DataTable>
              ) : (
                <p className="mt-4 mb-0 text-sm text-muted">No utilities yet.</p>
              )}
            </Card>
            <Card>
              <h2 className="m-0 text-base font-semibold">Usage</h2>
              <p className="mt-4 mb-0 text-sm text-muted">
                Usage charts will show after a statement import.
              </p>
            </Card>
          </section>
          <section className="mt-6">
            <h2 className="mb-3 text-base font-semibold">Insurance</h2>
            {insurance.data.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {insurance.data.map((policy) => (
                  <Card key={policy.id}>
                    <div className="flex items-center justify-between">
                      <p className="m-0 text-sm font-semibold">{policy.name}</p>
                      <Pill>{policy.renewal}</Pill>
                    </div>
                    <p className="num mt-3.5 mb-0 text-[26px] font-bold">
                      {policy.premium}
                      <span className="text-sm font-medium text-muted"> /mo</span>
                    </p>
                    <ul className="mt-3.5 mb-0 grid list-none gap-2 p-0 text-[13px] text-muted">
                      {policy.rows.map((row) => (
                        <li key={row.label} className="flex justify-between">
                          <span>{row.label}</span>
                          <span className="num">{row.value}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 mb-0">
                      <Link to={`/bills/${policy.id}/edit`} className="text-sm font-semibold text-accent">
                        Edit
                      </Link>
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="mt-0 mb-0 text-sm text-muted">No insurance policies yet.</p>
            )}
          </section>
          <Card className="mt-6">
            <h2 className="m-0 text-base font-semibold">Upcoming payments</h2>
            {overview.data.upcoming.length > 0 ? (
              <DataTable
                columns={[
                  { key: 'due', label: 'Due' },
                  { key: 'bill', label: 'Bill' },
                  { key: 'from', label: 'Paid from' },
                  { key: 'amount', label: 'Amount', align: 'right' },
                ]}
              >
                {overview.data.upcoming.map((row) => (
                  <Row key={row.id}>
                    <Cell muted className="num">
                      {row.date}
                    </Cell>
                    <Cell>{row.description}</Cell>
                    <Cell>{row.account}</Cell>
                    <Cell align="right" className="num">
                      {row.amount}
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            ) : (
              <p className="mt-4 mb-0 text-sm text-muted">No upcoming payments recorded.</p>
            )}
          </Card>
        </>
      )}
    </>
  )
}
