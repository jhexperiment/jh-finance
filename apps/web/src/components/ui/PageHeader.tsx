import type { ButtonHTMLAttributes, ReactNode } from 'react'
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
          <Link to={crumb.to} className="font-semibold text-accent no-underline">
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

const ghostClass =
  'inline-block rounded-[10px] border border-line bg-white px-3.5 py-2 font-sans text-sm text-ink no-underline'
const primaryClass =
  'inline-block rounded-[10px] border-0 bg-accent px-3.5 py-2 font-sans text-sm font-medium text-white no-underline disabled:opacity-60'
const dangerClass =
  'inline-block rounded-[10px] border border-line bg-white px-3.5 py-2 font-sans text-sm text-loss no-underline'

type ActionProps = {
  children: ReactNode
  to?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function GhostButton({ children, to, type = 'button', ...props }: ActionProps) {
  if (to) {
    return (
      <Link to={to} className={ghostClass}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={ghostClass} {...props}>
      {children}
    </button>
  )
}

export function PrimaryButton({ children, to, type = 'button', ...props }: ActionProps) {
  if (to) {
    return (
      <Link to={to} className={primaryClass}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={primaryClass} {...props}>
      {children}
    </button>
  )
}

export function DangerButton({ children, type = 'button', ...props }: ActionProps) {
  return (
    <button type={type} className={dangerClass} {...props}>
      {children}
    </button>
  )
}
