import type { Tone } from 'shared'
import { Pill } from './Pill'

export function statusTone(status: string): Tone {
  const value = status.toLowerCase()
  if (['ready', 'paid', 'confirmed', 'vested', 'autopay', 'income'].includes(value)) {
    return 'gain'
  }
  if (['flagged'].includes(value)) {
    return 'loss'
  }
  if (
    ['upcoming', 'scheduled', 'pending', 'due oct 31', 'review'].some((token) =>
      value.includes(token),
    )
  ) {
    return 'warn'
  }
  return 'muted'
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={statusTone(status)}>{status}</Pill>
}
