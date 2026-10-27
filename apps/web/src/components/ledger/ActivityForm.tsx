import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/api/client'
import { FormError, FormField, SelectInput, TextInput } from '@/components/ui/FormField'
import { PrimaryButton } from '@/components/ui/PageHeader'
import { mutationError, todayInput, useInvalidateWorkspace } from '@/lib/workspace'

export function ActivityForm({ accountId }: { accountId: string }) {
  const invalidate = useInvalidateWorkspace()
  const [direction, setDirection] = useState<'out' | 'in'>('out')
  const mutation = useMutation({
    mutationFn: (input: {
      postedAt: string
      description: string
      amount: string
      category: string
    }) =>
      api.createTransaction({
        accountId,
        postedAt: input.postedAt,
        description: input.description,
        amount: direction === 'out' && !input.amount.trim().startsWith('-') ? `-${input.amount}` : input.amount,
        category: input.category || undefined,
      }),
    onSuccess: () => invalidate(),
  })

  return (
    <form
      className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        mutation.mutate(
          {
            postedAt: String(data.get('postedAt') ?? todayInput()),
            description: String(data.get('description') ?? ''),
            amount: String(data.get('amount') ?? ''),
            category: String(data.get('category') ?? ''),
          },
          {
            onSuccess: () => form.reset(),
          },
        )
      }}
    >
      <FormField label="Date">
        <TextInput name="postedAt" type="date" defaultValue={todayInput()} required />
      </FormField>
      <FormField label="Description">
        <TextInput name="description" required placeholder="Merchant or payee" />
      </FormField>
      <FormField label="Amount">
        <TextInput name="amount" required placeholder="0.00" inputMode="decimal" />
      </FormField>
      <FormField label="Direction">
        <SelectInput
          value={direction}
          onChange={(event) => setDirection(event.target.value as 'out' | 'in')}
        >
          <option value="out">Money out</option>
          <option value="in">Money in</option>
        </SelectInput>
      </FormField>
      <FormField label="Category">
        <TextInput name="category" placeholder="Optional" />
      </FormField>
      <div className="flex items-end">
        <PrimaryButton type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Add activity'}
        </PrimaryButton>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <FormError message={mutation.isError ? mutationError(mutation.error) : undefined} />
      </div>
    </form>
  )
}

export function RemoveButton({ onRemove, pending }: { onRemove: () => void; pending?: boolean }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={pending}
      className="border-0 bg-transparent p-0 font-sans text-[13px] text-loss"
    >
      Remove
    </button>
  )
}
