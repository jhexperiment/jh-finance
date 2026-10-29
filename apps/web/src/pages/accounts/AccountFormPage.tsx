import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CHAINS, CHAIN_LABEL, CHAIN_PLACEHOLDER, type AccountKind, type Chain } from 'shared'
import { api } from '@/api/client'
import { RemoveButton } from '@/components/ledger/ActivityForm'
import { Card } from '@/components/ui/Card'
import { FormError, FormField, FormGrid, SelectInput, TextInput } from '@/components/ui/FormField'
import { DangerButton, GhostButton, PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { mutationError, useInvalidateWorkspace } from '@/lib/workspace'

const sections = {
  cards: {
    crumb: { to: '/cards', label: 'Cards' },
    createTitle: 'Add card',
    editTitle: 'Edit card',
    subtitle: 'Name the card first. Upload a statement onto it later, or type activity now.',
    kinds: ['credit-card'] as AccountKind[],
    kindLocked: true,
    placeholder: 'Everyday card',
    maskPlaceholder: '4821',
  },
  statements: {
    crumb: { to: '/statements', label: 'Bank accounts' },
    createTitle: 'Add bank account',
    editTitle: 'Edit bank account',
    subtitle: 'Name the account first. Upload a statement onto it later, or type lines now.',
    kinds: ['bank'] as AccountKind[],
    kindLocked: true,
    placeholder: 'Everyday checking',
    maskPlaceholder: '0182',
  },
  investments: {
    crumb: { to: '/investments', label: 'Investments' },
    createTitle: 'Add investment account',
    editTitle: 'Edit account',
    subtitle: 'Brokerage, 401(k), or crypto. Holdings can be typed on the account page.',
    kinds: ['investment', 'crypto'] as AccountKind[],
    kindLocked: false,
    placeholder: 'Brokerage',
    maskPlaceholder: '',
  },
} as const

const subtypeOptions: Record<AccountKind, string[]> = {
  'credit-card': ['Credit card', 'Store card', 'Charge card'],
  bank: ['Checking', 'Savings', 'HYSA', 'Joint checking'],
  investment: ['Brokerage', 'Retirement', '401(k)', 'IRA'],
  crypto: ['Wallet', 'Exchange'],
}

const kindLabel: Record<AccountKind, string> = {
  'credit-card': 'Credit card',
  bank: 'Bank',
  investment: 'Investment',
  crypto: 'Crypto',
}

const chainLabel = CHAIN_LABEL

type AddressDraft = { key: string; address: string }

const bitcoinPlaceholders = [
  'xpub… (legacy 1…)',
  'zpub… (SegWit bc1q…)',
  'zpub… (Taproot bc1p…)',
]

function emptyAddress(): AddressDraft {
  return { key: crypto.randomUUID(), address: '' }
}

function bitcoinAddresses(): AddressDraft[] {
  return [emptyAddress(), emptyAddress(), emptyAddress()]
}

function addressPlaceholder(chain: Chain, index: number): string {
  if (chain === 'btc') return bitcoinPlaceholders[index] ?? CHAIN_PLACEHOLDER.btc
  return CHAIN_PLACEHOLDER[chain]
}

function accountHref(kind: AccountKind, id: string): string {
  if (kind === 'credit-card') return `/cards/${id}`
  if (kind === 'bank') return `/statements/${id}`
  return `/investments/${id}`
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
      watchChain: Chain
      watchAddresses: AddressDraft[]
    }) => {
      if (editing && id) {
        return api.updateAccount(id, {
          name: input.name,
          subtype: input.subtype,
          ...(section === 'investments'
            ? {}
            : { mask: input.mask || null, balance: input.balance }),
        })
      }
      const row = await api.createAccount({
        name: input.name,
        kind: input.kind,
        subtype: input.subtype,
        ...(section === 'investments'
          ? {}
          : { mask: input.mask, balance: input.balance }),
      })
      if (input.kind === 'crypto') {
        for (const watch of input.watchAddresses) {
          const address = watch.address.trim()
          if (!address) continue
          await api.createChainAddress(row.id, { chain: input.watchChain, address })
        }
      }
      return row
    },
    onSuccess: async (row) => {
      await invalidate()
      navigate(accountHref(row.kind, row.id))
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

  const current = account.data
  const [kind, setKind] = useState<AccountKind>(config.kinds[0])
  const [watchChain, setWatchChain] = useState<Chain>('btc')
  const [watchAddresses, setWatchAddresses] = useState<AddressDraft[]>(bitcoinAddresses)
  useEffect(() => {
    if (current?.kind) setKind(current.kind)
  }, [current?.kind])

  const bitcoinWatches = watchChain === 'btc'

  if (editing && account.isError) return <Navigate to={config.crumb.to} replace />
  if (editing && !account.data) return null

  const showMaskAndBalance = section !== 'investments'
  const showCryptoWatch = section === 'investments' && !editing && kind === 'crypto'
  const cancelTo = editing && id && current ? accountHref(current.kind, id) : config.crumb.to

  return (
    <>
      <PageHeader
        crumb={{ to: config.crumb.to, label: config.crumb.label, current: editing ? 'Edit' : 'Add' }}
        title={editing ? config.editTitle : config.createTitle}
        subtitle={config.subtitle}
      />
      <Card className="mt-6 max-w-xl">
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
              watchChain,
              watchAddresses,
            })
          }}
        >
          <FormGrid>
            <FormField label="Name">
              <TextInput name="name" required defaultValue={current?.name} placeholder={config.placeholder} />
            </FormField>
            {config.kindLocked ? null : (
              <FormField
                label="Kind"
                hint={editing ? 'Kind is set when the account is created.' : undefined}
              >
                <SelectInput
                  name="kind"
                  value={kind}
                  disabled={editing}
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
            <FormField
              label="Type"
              hint={
                section === 'investments'
                  ? 'Types follow the kind: Investment or Crypto.'
                  : undefined
              }
            >
              <SelectInput
                key={kind}
                name="subtype"
                defaultValue={current?.subtype ?? subtypeOptions[kind][0]}
              >
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
            {showCryptoWatch ? (
              <>
                <FormField label="Chain">
                  <SelectInput
                    name="chain"
                    value={watchChain}
                    onChange={(event) => {
                      const chain = event.target.value as Chain
                      setWatchChain(chain)
                      setWatchAddresses((rows) => {
                        if (chain === 'btc') {
                          if (rows.length >= 3) return rows
                          return [
                            ...rows,
                            ...Array.from({ length: 3 - rows.length }, emptyAddress),
                          ]
                        }
                        return rows.slice(0, 1)
                      })
                    }}
                  >
                    {CHAINS.map((chain) => (
                      <option key={chain} value={chain}>
                        {chainLabel[chain]}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                {bitcoinWatches ? (
                  <div className="grid gap-4">
                    <div>
                      <p className="m-0 text-[13px] font-medium">Watched addresses</p>
                      <p className="mt-1 mb-0 text-xs text-muted">
                        Bitcoin HD wallets need separate watches: legacy xpub, SegWit zpub, and
                        Taproot zpub. Leave unused rows blank. Never paste a seed phrase or
                        private key.
                      </p>
                    </div>
                    {watchAddresses.map((watch, index) => (
                      <div
                        key={watch.key}
                        className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                      >
                        <FormField label={`Watch ${index + 1}`}>
                          <TextInput
                            name={`address-${index}`}
                            value={watch.address}
                            placeholder={addressPlaceholder('btc', index)}
                            spellCheck={false}
                            onChange={(event) => {
                              const address = event.target.value
                              setWatchAddresses((rows) =>
                                rows.map((row) =>
                                  row.key === watch.key ? { ...row, address } : row,
                                ),
                              )
                            }}
                          />
                        </FormField>
                        {watchAddresses.length > 1 ? (
                          <div className="pb-2">
                            <RemoveButton
                              onRemove={() =>
                                setWatchAddresses((rows) =>
                                  rows.filter((row) => row.key !== watch.key),
                                )
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <div>
                      <GhostButton
                        onClick={() =>
                          setWatchAddresses((rows) => [...rows, emptyAddress()])
                        }
                      >
                        Add another watch
                      </GhostButton>
                    </div>
                  </div>
                ) : (
                  <FormField label="Watch address">
                    <TextInput
                      name="address-0"
                      value={watchAddresses[0]?.address ?? ''}
                      placeholder={addressPlaceholder(watchChain, 0)}
                      spellCheck={false}
                      onChange={(event) => {
                        const address = event.target.value
                        setWatchAddresses((rows) =>
                          rows[0]
                            ? rows.map((row, index) =>
                                index === 0 ? { ...row, address } : row,
                              )
                            : [{ ...emptyAddress(), address }],
                        )
                      }}
                    />
                  </FormField>
                )}
              </>
            ) : null}
            {showMaskAndBalance ? (
              <>
                <FormField label="Last four" hint="Optional">
                  <TextInput
                    name="mask"
                    defaultValue={current?.mask ?? ''}
                    placeholder={config.maskPlaceholder}
                    maxLength={8}
                  />
                </FormField>
                <FormField label={kind === 'credit-card' ? 'Balance owed' : 'Balance'}>
                  <TextInput
                    name="balance"
                    defaultValue={current?.balance ?? '0.00'}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </FormField>
              </>
            ) : null}
          </FormGrid>
          <FormError message={save.isError ? mutationError(save.error) : undefined} />
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <GhostButton to={cancelTo}>Cancel</GhostButton>
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
