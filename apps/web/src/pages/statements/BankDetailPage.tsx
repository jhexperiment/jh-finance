import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { BarChart } from '@/components/ui/BarChart'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { KvList } from '@/components/ui/KvList'
import { Metric } from '@/components/ui/Metric'
import { GhostButton, PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/Status'

export function BankDetailPage() {
  const { id = '' } = useParams()
  const { data, isError } = useQuery({
    queryKey: ['bank', id],
    queryFn: () => api.getBank(id),
  })
  if (isError) return <Navigate to="/statements" replace />
  if (!data) return null

  return (
    <>
      <PageHeader
        crumb={{ to: '/statements', label: 'Bank accounts', current: data.name }}
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
        {data.metrics.map((metric) => (
          <Metric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            tone={metric.tone}
            size="sm"
          />
        ))}
      </section>
      <section className="mt-6 grid grid-cols-[1.4fr_1fr] items-start gap-6">
        <Card>
          <h2 className="m-0 text-base font-semibold">Balance, last 6 months</h2>
          <BarChart
            series={data.series}
            caption={data.seriesCaption}
            ariaLabel="Month-end balance, last 6 months"
          />
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Account details</h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Recent activity</h2>
        <DataTable
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'description', label: 'Description' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', align: 'right' },
            { key: 'balance', label: 'Balance', align: 'right' },
          ]}
        >
          {data.activity.map((row) => (
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
              <Cell align="right" className="num">
                {row.balance}
              </Cell>
            </Row>
          ))}
        </DataTable>
      </Card>
    </>
  )
}
