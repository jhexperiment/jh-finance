import type { ReactNode } from 'react'
import type { Tone } from 'shared'

const tones: Record<Tone, string> = {
  default: 'text-ink',
  gain: 'text-gain',
  loss: 'text-loss',
  warn: 'text-warn',
  muted: 'text-muted',
}

export function Metric({
  label,
  value,
  hint,
  tone = 'default',
  size = 'md',
}: {
  label: string
  value: string
  hint: string
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
}) {
  const valueSize = size === 'lg' ? 'text-[30px]' : size === 'sm' ? 'text-2xl' : 'text-[26px]'
  return (
    <CardPad>
      <p className="m-0 text-[13px] text-muted">{label}</p>
      <p className={`num mt-2 mb-0 font-bold ${valueSize} ${tones[tone]}`}>{value}</p>
      <p className={`mt-1.5 mb-0 text-[13px] ${tone === 'gain' || tone === 'loss' || tone === 'warn' ? tones[tone] : 'text-muted'}`}>
        {hint}
      </p>
    </CardPad>
  )
}

function CardPad({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">{children}</div>
  )
}
