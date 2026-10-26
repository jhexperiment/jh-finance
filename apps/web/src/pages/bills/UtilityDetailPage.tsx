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

export function UtilityDetailPage() {
  const { id = '' } = useParams()
  const { data, isError } = useQuery({
    queryKey: ['utility', id],
    queryFn: () => api.getUtility(id),
  })
  if (isError) return <Navigate to="/bills" replace />
  if (!data) return null

  return (
    <>
      <PageHeader
        crumb={{ to: '/bills', label: 'Bills', current: data.name }}
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
          <h2 className="m-0 text-base font-semibold">
            {data.id === 'internet'
              ? 'Download speed, last 6 months'
              : `Usage, ${data.seriesUnit}, last 6 months`}
          </h2>
          {data.id === 'internet' ? (
            <p className="mt-1 mb-0 text-[13px] text-muted">
              Monthly average of speed tests, Mbps
            </p>
          ) : null}
          <BarChart
            series={data.series}
            caption={data.seriesCaption}
            ariaLabel={`${data.name} last 6 months`}
          />
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">
            {data.id === 'internet' ? 'Plan details' : 'Account details'}
          </h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Bill history</h2>
        <DataTable
          columns={[
            { key: 'due', label: 'Due' },
            ...(data.id === 'internet'
              ? []
              : [{ key: 'usage', label: 'Usage' }]),
            { key: 'from', label: 'Paid from' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount', align: 'right' },
          ]}
        >
          {data.history.map((row) => (
            <Row key={row.id}>
              <Cell muted className="num">
                {row.date}
              </Cell>
              {data.id === 'internet' ? null : <Cell className="num">{row.description}</Cell>}
              <Cell>{row.account}</Cell>
              <Cell>
                <StatusPill status={row.status ?? ''} />
              </Cell>
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
