import type { ReactNode } from 'react'

export function DataTable({
  columns,
  children,
}: {
  columns: { key: string; label: string; align?: 'left' | 'right' }[]
  children: ReactNode
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-medium tracking-[0.04em] text-muted uppercase">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`py-2.5 font-medium ${column.align === 'right' ? 'text-right' : ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Row({
  children,
  flagged,
}: {
  children: ReactNode
  flagged?: boolean
}) {
  return (
    <tr className={`border-t border-line ${flagged ? 'bg-loss-bg' : ''}`}>{children}</tr>
  )
}

export function Cell({
  children,
  align,
  muted,
  className = '',
}: {
  children: ReactNode
  align?: 'right'
  muted?: boolean
  className?: string
}) {
  return (
    <td
      className={`py-3 ${align === 'right' ? 'text-right' : ''} ${muted ? 'text-muted' : ''} ${className}`}
    >
      {children}
    </td>
  )
}
