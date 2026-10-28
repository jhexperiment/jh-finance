import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatMigrateNotice, type AccountKind } from 'shared'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { FormError, FormField, SelectInput } from '@/components/ui/FormField'
import { GhostButton, PrimaryButton } from '@/components/ui/PageHeader'
import { mutationError, useInvalidateWorkspace } from '@/lib/workspace'

const kindPhrase: Record<AccountKind, string> = {
  'credit-card': 'Credit card',
  bank: 'Bank',
  investment: 'Investment',
  crypto: 'Crypto',
}

function accountHref(kind: AccountKind, id: string): string {
  if (kind === 'credit-card') return `/cards/${id}`
  if (kind === 'bank') return `/statements/${id}`
  return `/investments/${id}`
}

export function MigrateAccountForm({
  accountId,
  kind,
  typeLabel,
  onCancel,
}: {
  accountId: string
  kind: AccountKind
  typeLabel: string
  onCancel: () => void
}) {
  const navigate = useNavigate()
  const invalidate = useInvalidateWorkspace()
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.getAccounts })
  const migrate = useMutation({
    mutationFn: (toAccountId: string) => api.migrateAccount(accountId, { toAccountId }),
    onSuccess: async (result) => {
      navigate(accountHref(result.destinationKind, result.destinationId), {
        replace: true,
        state: { notice: formatMigrateNotice(result) },
      })
      await invalidate()
    },
  })

  const phrase = `${kindPhrase[kind]} · ${typeLabel}`
  const targets = (accounts.data ?? []).filter(
    (row) => row.id !== accountId && row.kind === kind && row.typeLabel === typeLabel,
  )

  return (
    <Card className="mt-6">
      <h2 className="m-0 text-base font-semibold">Migrate to another account</h2>
      <p className="mt-1 mb-0 text-sm text-muted">
        Moves holdings, activity, and watched addresses from this account into the one you pick, then
        removes this account. Both accounts must be {phrase}. This records the move only. No money
        moves.
      </p>
      {!accounts.data ? null : targets.length === 0 ? (
        <>
          <p className="mt-3.5 mb-0 text-sm text-muted">
            There is no other {typeLabel} account to move into yet. Add one first.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <GhostButton onClick={onCancel}>Cancel</GhostButton>
          </div>
        </>
      ) : (
        <form
          className="mt-4 max-w-xl"
          onSubmit={(event) => {
            event.preventDefault()
            const toAccountId = String(new FormData(event.currentTarget).get('to') ?? '')
            migrate.mutate(toAccountId)
          }}
        >
          <FormField label="Move into">
            <SelectInput name="to" defaultValue={targets[0]?.id}>
              {targets.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormError message={migrate.isError ? mutationError(migrate.error) : undefined} />
          <div className="mt-4 flex flex-wrap gap-2">
            <GhostButton onClick={onCancel}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={migrate.isPending}>
              {migrate.isPending ? 'Migrating…' : 'Migrate and remove this account'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </Card>
  )
}
