import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { BarChart } from '@/components/ui/BarChart'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { KvList } from '@/components/ui/KvList'
import { Metric } from '@/components/ui/Metric'
import { GhostButton, PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { Pill } from '@/components/ui/Pill'
import { StatusPill } from '@/components/ui/Status'

export function CardDetailPage() {
  const { id = '' } = useParams()
  const { data, isError } = useQuery({
    queryKey: ['card', id],
    queryFn: () => api.getCard(id),
  })
  if (isError) return <Navigate to="/cards" replace />
  if (!data) return null

  return (
    <>
      <PageHeader
        crumb={{ to: '/cards', label: 'Cards', current: data.name }}
        title={data.name}
        subtitle={data.subtitle}
        actions={
          <div className="flex gap-2">
            <GhostButton>{data.secondaryAction}</GhostButton>
            <PrimaryButton>{data.primaryAction}</PrimaryButton>
          </div>
        }
      />
      <section className="mt-6 grid grid-cols-4 gap-4">
        <Metric
          label="Statement balance"
          value={data.statementBalance}
          hint={`Due ${data.dueDate}`}
          tone="warn"
          size="sm"
        />
        <Metric label="Minimum due" value={data.minimumDue} hint="Autopay pays full balance" size="sm" />
        <Metric label="Credit limit" value={data.creditLimit} hint={data.utilization} size="sm" />
        <Metric label="Rewards balance" value={data.rewards} hint={data.rewardsHint} size="sm" />
      </section>
      <section className="mt-6 grid grid-cols-[1.4fr_1fr] items-start gap-6">
        <Card>
          <h2 className="m-0 text-base font-semibold">Statement balances, last 6 months</h2>
          <BarChart
            series={data.series}
            caption={data.seriesCaption}
            ariaLabel="Statement balances, last 6 months"
          />
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Card details</h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Recent transactions</h2>
        <DataTable
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'merchant', label: 'Merchant' },
            { key: 'category', label: 'Category' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount', align: 'right' },
          ]}
        >
          {data.transactions.map((row) => (
            <Row key={row.id} flagged={row.flagged}>
              <Cell muted className="num">
                {row.date}
              </Cell>
              <Cell>{row.description}</Cell>
              <Cell>
                <Pill>{row.category ?? ''}</Pill>
              </Cell>
              <Cell>
                <StatusPill status={row.status ?? 'Posted'} />
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
    </>
  )
}
