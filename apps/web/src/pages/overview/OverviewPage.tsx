import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Tone } from 'shared'
import { api } from '@/api/client'
import { AllocationBar, AllocationLegend } from '@/components/ui/Allocation'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'

const attentionBg: Record<Tone, string> = {
  warn: 'bg-warn-bg',
  loss: 'bg-loss-bg',
  muted: 'bg-chip',
  gain: 'bg-gain-bg',
  default: 'bg-chip',
}

const attentionBar: Record<Tone, string> = {
  warn: 'bg-warn',
  loss: 'bg-loss',
  muted: 'bg-muted',
  gain: 'bg-gain',
  default: 'bg-muted',
}

export function OverviewPage() {
  const { data } = useQuery({ queryKey: ['overview'], queryFn: api.getOverview })
  if (!data) return null

  const max = Math.max(...data.series.map((point) => point.value))
  const min = Math.min(...data.series.map((point) => point.value))
  const points = data.series
    .map((point, index) => {
      const x = (index / (data.series.length - 1)) * 640
      const y = 160 - ((point.value - min) / (max - min || 1)) * 120
      return `${x},${y}`
    })
    .join(' ')
  const last = data.series[data.series.length - 1]
  const lastX = 640
  const lastY = 160 - ((last.value - min) / (max - min || 1)) * 120

  return (
    <>
      <section className="mt-7 grid grid-cols-[1.45fr_1fr] gap-6">
        <Card padding="lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="m-0 text-sm text-muted">Net worth, all accounts</p>
              <p className="num mt-1.5 mb-0 text-[44px] font-bold tracking-[-0.02em]">
                {data.netWorth}
              </p>
              <p className="mt-1.5 mb-0 text-sm font-semibold text-gain">
                {data.netWorthChange}
              </p>
            </div>
            <div
              role="group"
              aria-label="Time range"
              className="flex gap-1 rounded-[10px] bg-chip p-1"
            >
              {(['1M', '3M', '1Y', 'All'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={`rounded-[7px] border-0 px-2.5 py-1.5 font-sans text-[13px] ${
                    range === data.range
                      ? 'bg-white font-semibold shadow-sm'
                      : 'bg-transparent text-muted'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <svg
            viewBox="0 0 640 200"
            width="100%"
            height="200"
            role="img"
            aria-label="Net worth over the last 12 months"
            className="mt-5 block"
          >
            <g stroke="#E3E1D9" strokeWidth="1">
              <line x1="0" y1="40" x2="640" y2="40" />
              <line x1="0" y1="100" x2="640" y2="100" />
              <line x1="0" y1="160" x2="640" y2="160" />
            </g>
            <polyline
              points={`${points} 640,200 0,200`}
              fill="#0E6B63"
              fillOpacity="0.08"
              stroke="none"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#0E6B63"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={lastX} cy={lastY} r="5" fill="#0E6B63" />
          </svg>
          <div className="mt-2 flex justify-between text-xs text-muted">
            {data.seriesLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <Mini label="Cash" value={data.cash} hint="4 bank accounts" />
          <Mini
            label="Card balances"
            value={data.cardBalances}
            hint={data.cardHint}
            valueClass="text-warn"
          />
          <Mini
            label="Retirement and brokerage"
            value={data.retirement}
            hint={data.retirementHint}
          />
          <Mini
            label="Crypto"
            value={data.crypto}
            hint={data.cryptoHint}
            hintClass="text-loss"
          />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-6">
        <Card>
          <h2 className="m-0 text-base font-semibold">Allocation</h2>
          <AllocationBar slices={data.allocation} />
          <AllocationLegend slices={data.allocation} />
        </Card>
        <Card>
          <h2 className="m-0 text-base font-semibold">Needs attention</h2>
          <ul className="mt-4 mb-0 grid list-none gap-3 p-0">
            {data.attention.map((item) => (
              <li
                key={item.id}
                className={`flex gap-3 rounded-[10px] p-3 ${attentionBg[item.tone]}`}
              >
                <span
                  aria-hidden
                  className={`w-2 rounded ${attentionBar[item.tone]}`}
                />
                <div>
                  <p className="m-0 text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 mb-0 text-[13px] text-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-base font-semibold">Recent activity</h2>
          <Link to="/statements" className="text-sm font-semibold text-accent">
            View all
          </Link>
        </div>
        <DataTable
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'description', label: 'Description' },
            { key: 'account', label: 'Account' },
            { key: 'amount', label: 'Amount', align: 'right' },
          ]}
        >
          {data.activity.map((row) => (
            <Row key={row.id}>
              <Cell muted className="num">
                {row.date}
              </Cell>
              <Cell>{row.description}</Cell>
              <Cell muted>{row.account}</Cell>
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

function Mini({
  label,
  value,
  hint,
  valueClass,
  hintClass,
}: {
  label: string
  value: string
  hint: string
  valueClass?: string
  hintClass?: string
}) {
  return (
    <Card padding="sm">
      <p className="m-0 text-[13px] text-muted">{label}</p>
      <p className={`num mt-2 mb-0 text-2xl font-bold ${valueClass ?? ''}`}>{value}</p>
      <p className={`mt-1.5 mb-0 text-xs ${hintClass ?? 'text-muted'}`}>{hint}</p>
    </Card>
  )
}
