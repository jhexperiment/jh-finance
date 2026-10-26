import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({
  crumb,
  title,
  subtitle,
  actions,
}: {
  crumb?: { to: string; label: string; current: string }
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className={crumb ? 'mt-6' : 'mt-7'}>
      {crumb ? (
        <p className="mb-0 text-[13px] text-muted">
          <Link to={crumb.to} className="font-semibold text-accent">
            {crumb.label}
          </Link>
          {' / '}
          {crumb.current}
        </p>
      ) : null}
      <div className={`flex flex-wrap items-end justify-between gap-4 ${crumb ? 'mt-2' : ''}`}>
        <div>
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.01em]">{title}</h1>
          <p className="mt-1.5 mb-0 text-sm text-muted">{subtitle}</p>
        </div>
        {actions}
      </div>
    </div>
  )
}

export function GhostButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="rounded-[10px] border border-line bg-white px-3.5 py-2 font-sans text-sm"
    >
      {children}
    </button>
  )
}

export function PrimaryButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="rounded-[10px] border-0 bg-accent px-3.5 py-2 font-sans text-sm font-medium text-white"
    >
      {children}
    </button>
  )
}
