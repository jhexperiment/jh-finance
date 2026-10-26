import type { KeyValue } from 'shared'

export function KvList({ rows }: { rows: KeyValue[] }) {
  return (
    <div className="mt-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex justify-between gap-4 border-b border-line py-3 text-sm last:border-0"
        >
          <span className="text-muted">{row.label}</span>
          <span className="num text-right">{row.value}</span>
        </div>
      ))}
    </div>
  )
}
