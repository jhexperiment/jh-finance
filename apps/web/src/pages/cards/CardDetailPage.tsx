import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { ActivityForm, RemoveButton } from '@/components/ledger/ActivityForm'
import { StatementUpload } from '@/components/ledger/StatementUpload'
import { BarChart } from '@/components/ui/BarChart'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { KvList } from '@/components/ui/KvList'
import { Metric } from '@/components/ui/Metric'
import { GhostButton, PageHeader } from '@/components/ui/PageHeader'
import { Pill } from '@/components/ui/Pill'
import { StatusPill } from '@/components/ui/Status'
import { useInvalidateWorkspace } from '@/lib/workspace'

export function CardDetailPage() {
  const { id = '' } = useParams()
  const invalidate = useInvalidateWorkspace()
  const { data, isError } = useQuery({
    queryKey: ['card', id],
    queryFn: () => api.getCard(id),
  })
  const remove = useMutation({
    mutationFn: (transactionId: string) => api.deleteTransaction(transactionId),
    onSuccess: () => invalidate(),
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
          <div className="flex flex-wrap gap-2">
            <GhostButton to={`/cards/${data.id}/edit`}>{data.secondaryAction}</GhostButton>
            <StatementUpload />
          </div>
        }
      />
      <section className="mt-6 grid grid-cols-4 gap-4">
        <Metric
          label="Statement balance"
          value={data.statementBalance}
          hint={data.dueDate === '—' ? 'Recorded balance' : `Due ${data.dueDate}`}
          tone="warn"
          size="sm"
        />
        <Metric label="Minimum due" value={data.minimumDue} hint="Add this from a statement later" size="sm" />
        <Metric label="Credit limit" value={data.creditLimit} hint={data.utilization} size="sm" />
        <Metric label="Rewards balance" value={data.rewards} hint={data.rewardsHint || 'Not recorded'} size="sm" />
      </section>
      <section className="mt-6 grid grid-cols-[1.4fr_1fr] items-start gap-6">
        <Card>
          <h2 className="m-0 text-base font-semibold">Balance</h2>
          <BarChart
            series={data.series}
            caption={data.seriesCaption}
            ariaLabel="Card balance"
          />
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Card details</h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      <Card className="mt-6">
        <h2 className="m-0 text-base font-semibold">Recent transactions</h2>
        {data.transactions.length > 0 ? (
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'merchant', label: 'Merchant' },
              { key: 'category', label: 'Category' },
              { key: 'status', label: 'Status' },
              { key: 'amount', label: 'Amount', align: 'right' },
              { key: 'actions', label: '', align: 'right' },
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
                <Cell align="right">
                  <RemoveButton onRemove={() => remove.mutate(row.id)} pending={remove.isPending} />
                </Cell>
              </Row>
            ))}
          </DataTable>
        ) : (
          <p className="mt-4 mb-0 text-sm text-muted">No activity on this card yet.</p>
        )}
        <ActivityForm accountId={data.id} />
      </Card>
    </>
  )
}
