import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

const controlClass =
  'mt-1.5 w-full rounded-[10px] border border-line bg-white px-3 py-2 font-sans text-sm text-ink'

export function FormField({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="mt-6 grid max-w-xl gap-4">{children}</div>
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-3 mb-0 text-sm text-loss">{message}</p>
}
