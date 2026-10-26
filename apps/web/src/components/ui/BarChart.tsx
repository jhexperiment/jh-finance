import type { SeriesPoint } from 'shared'

export function BarChart({
  series,
  caption,
  ariaLabel,
}: {
  series: SeriesPoint[]
  caption?: string
  ariaLabel: string
}) {
  const max = Math.max(...series.map((point) => point.value), 1)
  return (
    <div>
      <div
        role="img"
        aria-label={ariaLabel}
        className="mt-5 flex h-40 items-end gap-3 border-b border-line"
      >
        {series.map((point, index) => {
          const height = Math.max(8, Math.round((point.value / max) * 140))
          const last = index === series.length - 1
          return (
            <span
              key={point.label}
              className={`flex-1 rounded-t-md ${last ? 'bg-accent' : 'bg-silver'}`}
              style={{ height }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        {series.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
      {caption ? (
        <p className="mt-3.5 mb-0 text-[13px] leading-5 text-muted">{caption}</p>
      ) : null}
    </div>
  )
}
