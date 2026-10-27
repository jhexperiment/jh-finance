import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { KvList } from '@/components/ui/KvList'
import { Metric } from '@/components/ui/Metric'
import { GhostButton, PageHeader } from '@/components/ui/PageHeader'
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
        actions={<GhostButton to={`/bills/${data.id}/edit`}>Edit bill</GhostButton>}
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
          <h2 className="m-0 text-base font-semibold">Usage</h2>
          <p className="mt-4 mb-0 text-sm text-muted">{data.seriesCaption}</p>
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Account details</h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Bill history</h2>
        <DataTable
          columns={[
            { key: 'due', label: 'Due' },
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
