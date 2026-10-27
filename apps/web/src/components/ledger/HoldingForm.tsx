import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { FormError, FormField, TextInput } from '@/components/ui/FormField'
import { PrimaryButton } from '@/components/ui/PageHeader'
import { mutationError, useInvalidateWorkspace } from '@/lib/workspace'

export function HoldingForm({ accountId }: { accountId: string }) {
  const invalidate = useInvalidateWorkspace()
  const mutation = useMutation({
    mutationFn: (input: {
      name: string
      symbol: string
      quantity: string
      value: string
      costBasis: string
    }) =>
      api.createHolding({
        accountId,
        name: input.name,
        symbol: input.symbol || undefined,
        quantity: input.quantity || undefined,
        value: input.value,
        costBasis: input.costBasis || undefined,
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
            name: String(data.get('name') ?? ''),
            symbol: String(data.get('symbol') ?? ''),
            quantity: String(data.get('quantity') ?? ''),
            value: String(data.get('value') ?? ''),
            costBasis: String(data.get('costBasis') ?? ''),
          },
          { onSuccess: () => form.reset() },
        )
      }}
    >
      <FormField label="Name">
        <TextInput name="name" required placeholder="VTI" />
      </FormField>
      <FormField label="Symbol">
        <TextInput name="symbol" placeholder="Optional" />
      </FormField>
      <FormField label="Quantity">
        <TextInput name="quantity" placeholder="0" inputMode="decimal" />
      </FormField>
      <FormField label="Value">
        <TextInput name="value" required placeholder="0.00" inputMode="decimal" />
      </FormField>
      <FormField label="Cost basis">
        <TextInput name="costBasis" placeholder="Same as value" inputMode="decimal" />
      </FormField>
      <div className="flex items-end">
        <PrimaryButton type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Add holding'}
        </PrimaryButton>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <FormError message={mutation.isError ? mutationError(mutation.error) : undefined} />
      </div>
    </form>
  )
}
