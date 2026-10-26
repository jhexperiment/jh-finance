import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  padding = 'md',
}: {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}) {
  const pad = padding === 'lg' ? 'p-7' : padding === 'sm' ? 'p-5' : 'p-6'
  return (
    <div className={`rounded-2xl border border-line bg-white ${pad} ${className}`}>
      {children}
    </div>
  )
}
