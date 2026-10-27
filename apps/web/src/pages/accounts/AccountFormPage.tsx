import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { AccountKind } from 'shared'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { FormError, FormField, FormGrid, SelectInput, TextInput } from '@/components/ui/FormField'
import { DangerButton, PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { mutationError, useInvalidateWorkspace } from '@/lib/workspace'

const sections = {
  cards: {
    crumb: { to: '/cards', label: 'Cards' },
    createTitle: 'Add card',
    editTitle: 'Edit card',
    subtitle: 'Name the card first. Upload a statement onto it later, or type activity now.',
    kinds: ['credit-card'] as AccountKind[],
    kindLocked: true,
  },
  statements: {
    crumb: { to: '/statements', label: 'Bank accounts' },
    createTitle: 'Add bank account',
    editTitle: 'Edit bank account',
    subtitle: 'Name the account first. Upload a statement onto it later, or type lines now.',
    kinds: ['bank'] as AccountKind[],
    kindLocked: true,
  },
  investments: {
    crumb: { to: '/investments', label: 'Investments' },
    createTitle: 'Add investment account',
    editTitle: 'Edit account',
    subtitle: 'Brokerage, 401(k), or crypto. Holdings can be typed on the account page.',
    kinds: ['investment', 'crypto'] as AccountKind[],
    kindLocked: false,
  },
} as const

const subtypeOptions: Record<AccountKind, string[]> = {
  'credit-card': ['Credit card', 'Store card', 'Charge card'],
  bank: ['Checking', 'Savings', 'HYSA', 'Joint checking'],
  investment: ['Brokerage', 'Retirement', '401(k)', 'IRA'],
  crypto: ['Crypto', 'Exchange', 'Wallet'],
}

const kindLabel: Record<AccountKind, string> = {
  'credit-card': 'Credit card',
  bank: 'Bank',
  investment: 'Investment',
  crypto: 'Crypto',
}

export function AccountFormPage({ section }: { section: keyof typeof sections }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const invalidate = useInvalidateWorkspace()
  const config = sections[section]
  const editing = Boolean(id)
  const account = useQuery({
    queryKey: ['account', id],
    queryFn: () => api.getAccount(id!),
    enabled: editing,
  })

  const save = useMutation({
    mutationFn: async (input: {
      name: string
      kind: AccountKind
      subtype: string
      mask: string
      balance: string
    }) => {
      if (editing && id) {
        return api.updateAccount(id, {
          name: input.name,
          subtype: input.subtype,
          mask: input.mask || null,
          balance: input.balance,
        })
      }
      return api.createAccount(input)
    },
    onSuccess: async (row) => {
      await invalidate()
      navigate(row.kind === 'credit-card' ? `/cards/${row.id}` : row.kind === 'bank' ? `/statements/${row.id}` : `/investments/${row.id}`)
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      if (!id) return
      await api.deleteAccount(id)
    },
    onSuccess: async () => {
      await invalidate()
      navigate(config.crumb.to)
    },
  })

  if (editing && account.isError) return <Navigate to={config.crumb.to} replace />
  if (editing && !account.data) return null

  const current = account.data
  const [kind, setKind] = useState<AccountKind>(config.kinds[0])
  useEffect(() => {
    if (current?.kind) setKind(current.kind)
  }, [current?.kind])

  return (
    <>
      <PageHeader
        crumb={{ to: config.crumb.to, label: config.crumb.label, current: editing ? 'Edit' : 'Add' }}
        title={editing ? config.editTitle : config.createTitle}
        subtitle={config.subtitle}
      />
      <Card className="mt-6">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            save.mutate({
              name: String(data.get('name') ?? ''),
              kind,
              subtype: String(data.get('subtype') ?? ''),
              mask: String(data.get('mask') ?? ''),
              balance: String(data.get('balance') ?? ''),
            })
          }}
        >
          <FormGrid>
            <FormField label="Name">
              <TextInput name="name" required defaultValue={current?.name} placeholder="Everyday card" />
            </FormField>
            {config.kindLocked ? null : (
              <FormField label="Kind">
                <SelectInput
                  name="kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as AccountKind)}
                >
                  {config.kinds.map((option) => (
                    <option key={option} value={option}>
                      {kindLabel[option]}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            )}
            <FormField label="Type">
              <SelectInput name="subtype" defaultValue={current?.subtype ?? subtypeOptions[kind][0]}>
                {subtypeOptions[kind].map((subtype) => (
                  <option key={subtype} value={subtype}>
                    {subtype}
                  </option>
                ))}
                {current?.subtype && !subtypeOptions[kind].includes(current.subtype) ? (
                  <option value={current.subtype}>{current.subtype}</option>
                ) : null}
              </SelectInput>
            </FormField>
            <FormField label="Last four" hint="Optional">
              <TextInput name="mask" defaultValue={current?.mask ?? ''} placeholder="4821" maxLength={8} />
            </FormField>
            <FormField label={kind === 'credit-card' ? 'Balance owed' : 'Balance'}>
              <TextInput
                name="balance"
                defaultValue={current?.balance ?? '0.00'}
                inputMode="decimal"
                placeholder="0.00"
              />
            </FormField>
          </FormGrid>
          <FormError message={save.isError ? mutationError(save.error) : undefined} />
          <div className="mt-6 flex flex-wrap gap-2">
            <PrimaryButton type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save' : 'Add account'}
            </PrimaryButton>
            {editing ? (
              <DangerButton
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm('Delete this account and its activity?')) remove.mutate()
                }}
              >
                {remove.isPending ? 'Deleting…' : 'Delete account'}
              </DangerButton>
            ) : null}
          </div>
        </form>
      </Card>
    </>
  )
}
