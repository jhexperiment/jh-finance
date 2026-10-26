import type { AllocationSlice } from 'shared'

export function AllocationBar({ slices }: { slices: AllocationSlice[] }) {
  return (
    <div className="mt-[18px] flex h-3.5 overflow-hidden rounded-full">
      {slices.map((slice) => (
        <span
          key={slice.label}
          className="h-full"
          style={{ flex: slice.pct, background: slice.color }}
        />
      ))}
    </div>
  )
}

export function AllocationLegend({ slices }: { slices: AllocationSlice[] }) {
  return (
    <ul className="mt-5 mb-0 grid list-none grid-cols-2 gap-3 p-0 text-sm">
      {slices.map((slice) => (
        <li key={slice.label} className="flex justify-between">
          <span>
            <i
              className="mr-2 inline-block h-2 w-2 rounded-sm"
              style={{ background: slice.color }}
            />
            {slice.label}
          </span>
          <span className="num text-muted">{slice.pct}%</span>
        </li>
      ))}
    </ul>
  )
}
