import type { Tone } from 'shared'

const tones: Record<string, string> = {
  default: 'bg-chip text-ink',
  gain: 'bg-gain-bg text-gain',
  loss: 'bg-loss-bg text-loss',
  warn: 'bg-warn-bg text-warn',
  muted: 'bg-chip text-muted',
}

export function Pill({
  children,
  tone = 'default',
}: {
  children: string
  tone?: Tone | 'default'
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}
