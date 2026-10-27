import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { ActivityForm, RemoveButton } from '@/components/ledger/ActivityForm'
import { HoldingForm } from '@/components/ledger/HoldingForm'
import { BarChart } from '@/components/ui/BarChart'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { KvList } from '@/components/ui/KvList'
import { Metric } from '@/components/ui/Metric'
import { GhostButton, PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/Status'
import { useInvalidateWorkspace } from '@/lib/workspace'

export function InvestmentDetailPage() {
  const { id = '' } = useParams()
  const invalidate = useInvalidateWorkspace()
  const { data, isError } = useQuery({
    queryKey: ['investment', id],
    queryFn: () => api.getInvestment(id),
  })
  const removeHolding = useMutation({
    mutationFn: (holdingId: string) => api.deleteHolding(holdingId),
    onSuccess: () => invalidate(),
  })
  const removeActivity = useMutation({
    mutationFn: (transactionId: string) => api.deleteTransaction(transactionId),
    onSuccess: () => invalidate(),
  })
  if (isError) return <Navigate to="/investments" replace />
  if (!data) return null

  const crumbLabel = data.kind === 'crypto' ? 'Crypto' : 'Investments'

  return (
    <>
      <PageHeader
        crumb={{ to: '/investments', label: crumbLabel, current: data.name.split(',')[0] }}
        title={data.name}
        subtitle={data.subtitle}
        actions={<GhostButton to={`/investments/${data.id}/edit`}>{data.secondaryAction}</GhostButton>}
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
            {data.mix ? 'Mix by holding' : 'Value'}
          </h2>
          {data.mix ? (
            <ul className="mt-[18px] mb-0 grid list-none gap-3.5 p-0 text-sm">
              {data.mix.map((slice) => (
                <li key={slice.label}>
                  <div className="flex justify-between">
                    <span>{slice.label}</span>
                    <span className="num">{slice.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-chip">
                    <span
                      className="block h-2 rounded-full"
                      style={{ width: `${slice.pct}%`, background: slice.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <BarChart
              series={data.series}
              caption={data.seriesCaption}
              ariaLabel="Value"
            />
          )}
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Account details</h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Holdings</h2>
        {data.holdings.length > 0 ? (
          <DataTable
            columns={[
              { key: 'fund', label: 'Holding' },
              { key: 'type', label: 'Type' },
              { key: 'share', label: 'Share' },
              { key: 'value', label: 'Value', align: 'right' },
              { key: 'actions', label: '', align: 'right' },
            ]}
          >
            {data.holdings.map((holding) => (
              <Row key={holding.id}>
                <Cell>
                  <strong className="font-semibold">{holding.name}</strong>
                </Cell>
                <Cell>{holding.type}</Cell>
                <Cell className="num">{holding.share}</Cell>
                <Cell align="right" className="num">
                  {holding.value}
                </Cell>
                <Cell align="right">
                  <RemoveButton
                    onRemove={() => removeHolding.mutate(holding.id)}
                    pending={removeHolding.isPending}
                  />
                </Cell>
              </Row>
            ))}
          </DataTable>
        ) : (
          <p className="mt-4 mb-0 text-sm text-muted">No holdings on this account yet.</p>
        )}
        <HoldingForm accountId={data.id} />
      </Card>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Recent activity</h2>
        {data.activity.length > 0 ? (
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'activity', label: 'Activity' },
              { key: 'status', label: 'Category' },
              { key: 'amount', label: 'Amount', align: 'right' },
              { key: 'actions', label: '', align: 'right' },
            ]}
          >
            {data.activity.map((row) => (
              <Row key={row.id}>
                <Cell muted className="num">
                  {row.date}
                </Cell>
                <Cell>{row.description}</Cell>
                <Cell>
                  <StatusPill status={row.status ?? row.category ?? ''} />
                </Cell>
                <Cell
                  align="right"
                  className={`num ${row.amountTone === 'gain' ? 'text-gain' : ''}`}
                >
                  {row.amount}
                </Cell>
                <Cell align="right">
                  <RemoveButton
                    onRemove={() => removeActivity.mutate(row.id)}
                    pending={removeActivity.isPending}
                  />
                </Cell>
              </Row>
            ))}
          </DataTable>
        ) : (
          <p className="mt-4 mb-0 text-sm text-muted">No activity on this account yet.</p>
        )}
        <ActivityForm accountId={data.id} />
      </Card>
    </>
  )
}
