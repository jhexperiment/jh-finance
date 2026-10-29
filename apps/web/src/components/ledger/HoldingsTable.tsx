import { useState } from 'react'
import type { Holding } from 'shared'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { RemoveButton } from './ActivityForm'

export function HoldingsTable({
  holdings,
  onRemove,
  pending,
}: {
  holdings: Holding[]
  onRemove: (id: string) => void
  pending: boolean
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <DataTable
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'symbol', label: 'Symbol' },
        { key: 'quantity', label: 'Quantity', align: 'right' },
        { key: 'value', label: 'Value', align: 'right' },
        { key: 'cost', label: 'Cost basis', align: 'right' },
        { key: 'actions', label: '', align: 'right' },
      ]}
    >
      {holdings.flatMap((holding) => {
        const tokens = holding.tokens ?? []
        const expanded = Boolean(open[holding.id])
        const rows = [
          <Row key={holding.id}>
            <Cell>
              {tokens.length > 0 ? (
                <button
                  type="button"
                  className="mr-2 inline-flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border border-line bg-white text-muted align-middle"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Collapse tokens' : 'Expand tokens'}
                  onClick={() => setOpen((current) => ({ ...current, [holding.id]: !current[holding.id] }))}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    aria-hidden="true"
                    style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
                  >
                    <path
                      d="M3 2l4 3-4 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
              {holding.name}
              {tokens.length > 0 ? (
                <span className="text-muted">
                  {` · ${tokens.length} ${tokens.length === 1 ? 'token' : 'tokens'}`}
                </span>
              ) : null}
            </Cell>
            <Cell muted>{holding.symbol || '—'}</Cell>
            <Cell align="right" className="num">
              {holding.quantity || '—'}
            </Cell>
            <Cell align="right" className="num">
              {holding.value}
            </Cell>
            <Cell align="right" className="num">
              {holding.costBasis || '—'}
            </Cell>
            <Cell align="right">
              {holding.canRemove !== false ? (
                <RemoveButton onRemove={() => onRemove(holding.id)} pending={pending} />
              ) : null}
            </Cell>
          </Row>,
        ]
        if (expanded) {
          for (const token of tokens) {
            rows.push(
              <Row key={`${holding.id}:${token.symbol}`}>
                <Cell muted className="pl-10">
                  {`${token.symbol} token`}
                </Cell>
                <Cell muted>{token.symbol}</Cell>
                <Cell align="right" className="num">
                  {token.quantity}
                </Cell>
                <Cell align="right" className="num text-muted">
                  {token.value}
                </Cell>
                <Cell align="right" className="num text-muted">
                  {token.costBasis}
                </Cell>
                <Cell />
              </Row>,
            )
          }
        }
        return rows
      })}
    </DataTable>
  )
}
