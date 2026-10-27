import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { ActivityForm, RemoveButton } from '@/components/ledger/ActivityForm'
import { BarChart } from '@/components/ui/BarChart'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { KvList } from '@/components/ui/KvList'
import { Metric } from '@/components/ui/Metric'
import { StatementUpload } from '@/components/ledger/StatementUpload'
import { GhostButton, PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/Status'
import { useInvalidateWorkspace } from '@/lib/workspace'

export function BankDetailPage() {
  const { id = '' } = useParams()
  const invalidate = useInvalidateWorkspace()
  const { data, isError } = useQuery({
    queryKey: ['bank', id],
    queryFn: () => api.getBank(id),
  })
  const remove = useMutation({
    mutationFn: (transactionId: string) => api.deleteTransaction(transactionId),
    onSuccess: () => invalidate(),
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
          <div className="flex flex-wrap gap-2">
            <GhostButton to={`/statements/${data.id}/edit`}>{data.secondaryAction}</GhostButton>
            <StatementUpload kind="bank" />
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
          <h2 className="m-0 text-base font-semibold">Balance</h2>
          <BarChart
            series={data.series}
            caption={data.seriesCaption}
            ariaLabel="Account balance"
          />
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Account details</h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Recent activity</h2>
        {data.activity.length > 0 ? (
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'description', label: 'Description' },
              { key: 'category', label: 'Category' },
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
                  <StatusPill status={row.category ?? ''} />
                </Cell>
                <Cell
                  align="right"
                  className={`num ${row.amountTone === 'gain' ? 'text-gain' : ''}`}
                >
                  {row.amount}
                </Cell>
                <Cell align="right">
                  <RemoveButton onRemove={() => remove.mutate(row.id)} pending={remove.isPending} />
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
