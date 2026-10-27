import type { ReactNode } from 'react'
import { Card } from './Card'

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <Card className="mt-10" padding="lg">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <p className="mt-1.5 mb-0 max-w-xl text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  )
}
