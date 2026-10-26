import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { BarChart } from '@/components/ui/BarChart'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Metric } from '@/components/ui/Metric'
import { Pill } from '@/components/ui/Pill'
import { StatusPill } from '@/components/ui/Status'

export function BillsPage() {
  const overview = useQuery({ queryKey: ['bills-overview'], queryFn: api.getBillsOverview })
  const utilities = useQuery({ queryKey: ['utilities'], queryFn: api.getUtilities })
  const insurance = useQuery({ queryKey: ['insurance'], queryFn: api.getInsurance })
  if (!overview.data || !utilities.data || !insurance.data) return null

  return (
    <>
      <PageHeader
        title="Bills and insurance"
        subtitle="Utilities and premiums across 4 bank accounts and 4 cards"
      />
      <section className="mt-6 grid grid-cols-4 gap-4">
        <Metric
          label="Utilities, monthly"
          value={overview.data.utilitiesMonthly}
          hint="4 services"
        />
        <Metric
          label="Insurance, monthly"
          value={overview.data.insuranceMonthly}
          hint="Auto, renters, health"
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
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Electricity usage</h2>
          <p className="mt-1 mb-0 text-[13px] text-muted">kWh, last 6 months</p>
          <BarChart
            series={overview.data.electricitySeries}
            caption="October is 8% below May. Average cost per kWh is $0.227."
            ariaLabel="Electricity usage in kWh, last 6 months"
          />
        </Card>
      </section>
      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Insurance</h2>
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
              {policy.progress ? (
                <>
                  <p className="mt-3.5 mb-0 text-[13px] text-muted">
                    Deductible met:{' '}
                    <span className="num text-ink">{policy.progress.hint}</span>
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-chip">
                    <span
                      className="block h-2 rounded-full bg-accent"
                      style={{ width: `${policy.progress.pct}%` }}
                    />
                  </div>
                  <p className="mt-3.5 mb-0 text-[13px] text-muted">
                    Out-of-pocket max: <span className="num text-ink">$1,400 of $6,500</span>
                  </p>
                </>
              ) : (
                <ul className="mt-3.5 mb-0 grid list-none gap-2 p-0 text-[13px] text-muted">
                  {policy.rows.map((row) => (
                    <li key={row.label} className="flex justify-between">
                      <span>{row.label}</span>
                      <span
                        className={`num ${row.value.startsWith('Yes') ? 'text-gain' : ''}`}
                      >
                        {row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Upcoming payments</h2>
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
      </Card>
    </>
  )
}
