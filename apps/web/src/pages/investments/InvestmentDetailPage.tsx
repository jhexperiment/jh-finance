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

export function InvestmentDetailPage() {
  const { id = '' } = useParams()
  const { data, isError } = useQuery({
    queryKey: ['investment', id],
    queryFn: () => api.getInvestment(id),
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
            {data.mix ? 'Mix by fund' : 'Value, last 6 months'}
          </h2>
          {data.mix ? (
            <>
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
              {data.callout ? (
                <div className="mt-5 rounded-xl bg-chip p-3.5">
                  <p className="m-0 text-[13px] font-semibold">{data.callout.title}</p>
                  <p className="mt-1 mb-0 text-[13px] leading-5 text-muted">
                    {data.callout.body}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <BarChart
              series={data.series}
              caption={data.seriesCaption}
              ariaLabel="Value, last 6 months"
            />
          )}
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">
            {data.kind === 'crypto' && data.id === 'cold-wallet'
              ? 'Wallet details'
              : data.id === '401k'
                ? 'Plan details'
                : 'Account details'}
          </h2>
          <KvList rows={data.details} />
        </Card>
      </section>
      {data.holdings.length > 0 && data.kind === 'investment' ? (
        <Card className="mt-6">
          <h2 className="m-0 text-base font-semibold">Holdings</h2>
          <DataTable
            columns={[
              { key: 'fund', label: 'Fund' },
              { key: 'type', label: 'Type' },
              { key: 'share', label: 'Share' },
              { key: 'day', label: 'Day', align: 'right' },
              { key: 'value', label: 'Value', align: 'right' },
            ]}
          >
            {data.holdings.map((holding) => (
              <Row key={holding.id}>
                <Cell>
                  <strong className="font-semibold">{holding.name}</strong>
                </Cell>
                <Cell>{holding.type}</Cell>
                <Cell className="num">{holding.share}</Cell>
                <Cell
                  align="right"
                  className={`num ${holding.dayTone === 'gain' ? 'text-gain' : 'text-loss'}`}
                >
                  {holding.dayPct}
                </Cell>
                <Cell align="right" className="num">
                  {holding.value}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Card>
      ) : null}
      {data.extraTables?.map((table) => (
        <Card key={table.title} className="mt-6">
          <h2 className="m-0 text-base font-semibold">{table.title}</h2>
          <DataTable
            columns={table.columns.map((label, index) => ({
              key: String(index),
              label,
              align: index === table.columns.length - 1 ? 'right' : 'left',
            }))}
          >
            {table.rows.map((row, rowIndex) => (
              <Row key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <Cell
                    key={cellIndex}
                    align={cellIndex === row.length - 1 ? 'right' : undefined}
                    className="num"
                    muted={cellIndex === 0}
                  >
                    {cellIndex === 2 && (cell === 'Scheduled' || cell === 'Vested') ? (
                      <StatusPill status={cell} />
                    ) : (
                      cell
                    )}
                  </Cell>
                ))}
              </Row>
            ))}
          </DataTable>
        </Card>
      ))}
      {data.activity.length > 0 ? (
        <Card className="mt-6">
          <h2 className="m-0 text-base font-semibold">Recent activity</h2>
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'activity', label: 'Activity' },
              { key: 'status', label: data.kind === 'crypto' ? 'Status' : 'Category' },
              { key: 'amount', label: 'Amount', align: 'right' },
              ...(data.kind === 'crypto'
                ? [{ key: 'value', label: 'Value at time', align: 'right' as const }]
                : []),
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
                {data.kind === 'crypto' ? (
                  <Cell align="right" className="num">
                    {row.balance}
                  </Cell>
                ) : null}
              </Row>
            ))}
          </DataTable>
        </Card>
      ) : null}
    </>
  )
}
