import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { BillKind } from 'shared'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { FormError, FormField, FormGrid, SelectInput, TextInput } from '@/components/ui/FormField'
import { DangerButton, PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { dateInputValue, mutationError, useInvalidateWorkspace } from '@/lib/workspace'

export function BillFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const invalidate = useInvalidateWorkspace()
  const editing = Boolean(id)
  const bill = useQuery({
    queryKey: ['bill', id],
    queryFn: () => api.getBill(id!),
    enabled: editing,
  })
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.getAccounts })

  const save = useMutation({
    mutationFn: async (input: {
      name: string
      kind: BillKind
      amount: string
      dueAt: string
      paidFromId: string
      status: string
    }) => {
      if (editing && id) {
        return api.updateBill(id, {
          name: input.name,
          amount: input.amount,
          dueAt: input.dueAt || null,
          paidFromId: input.paidFromId || null,
          status: input.status,
        })
      }
      return api.createBill(input)
    },
    onSuccess: async (row) => {
      await invalidate()
      navigate(row.kind === 'utility' ? `/bills/${row.id}` : '/bills')
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      if (!id) return
      await api.deleteBill(id)
    },
    onSuccess: async () => {
      await invalidate()
      navigate('/bills')
    },
  })

  if (editing && bill.isError) return <Navigate to="/bills" replace />
  if (editing && !bill.data) return null
  if (!accounts.data) return null

  const current = bill.data

  return (
    <>
      <PageHeader
        crumb={{ to: '/bills', label: 'Bills', current: editing ? 'Edit' : 'Add' }}
        title={editing ? 'Edit bill' : 'Add bill'}
        subtitle="Utilities get a detail page. Insurance stays as a summary card."
      />
      <Card className="mt-6">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            save.mutate({
              name: String(data.get('name') ?? ''),
              kind: String(data.get('kind') ?? 'utility') as BillKind,
              amount: String(data.get('amount') ?? ''),
              dueAt: String(data.get('dueAt') ?? ''),
              paidFromId: String(data.get('paidFromId') ?? ''),
              status: String(data.get('status') ?? 'Upcoming'),
            })
          }}
        >
          <FormGrid>
            <FormField label="Name">
              <TextInput name="name" required defaultValue={current?.name} placeholder="Electric" />
            </FormField>
            <FormField label="Kind">
              {editing ? <input type="hidden" name="kind" value={current?.kind ?? 'utility'} /> : null}
              <SelectInput
                name={editing ? undefined : 'kind'}
                defaultValue={current?.kind ?? 'utility'}
                disabled={editing}
              >
                <option value="utility">Utility</option>
                <option value="insurance">Insurance</option>
              </SelectInput>
            </FormField>
            <FormField label="Amount">
              <TextInput name="amount" defaultValue={current?.amount ?? ''} placeholder="0.00" inputMode="decimal" />
            </FormField>
            <FormField label="Due date">
              <TextInput name="dueAt" type="date" defaultValue={dateInputValue(current?.dueAt)} />
            </FormField>
            <FormField label="Status">
              <SelectInput name="status" defaultValue={current?.status ?? 'Upcoming'}>
                <option>Upcoming</option>
                <option>Due</option>
                <option>Paid</option>
              </SelectInput>
            </FormField>
            <FormField label="Paid from">
              <SelectInput name="paidFromId" defaultValue={current?.paidFromId ?? ''}>
                <option value="">Not linked</option>
                {accounts.data.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </FormGrid>
          <FormError message={save.isError ? mutationError(save.error) : undefined} />
          <div className="mt-6 flex flex-wrap gap-2">
            <PrimaryButton type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save' : 'Add bill'}
            </PrimaryButton>
            {editing ? (
              <DangerButton
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm('Delete this bill?')) remove.mutate()
                }}
              >
                {remove.isPending ? 'Deleting…' : 'Delete bill'}
              </DangerButton>
            ) : null}
          </div>
        </form>
      </Card>
    </>
  )
}
