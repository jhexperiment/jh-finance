import { useMutation, useMutationState } from '@tanstack/react-query'
import { CHAINS, type Chain } from 'shared'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Cell, DataTable, Row } from '@/components/ui/DataTable'
import { FormError, FormField, SelectInput, TextInput } from '@/components/ui/FormField'
import { GhostButton, PrimaryButton } from '@/components/ui/PageHeader'
import { mutationError, useInvalidateWorkspace } from '@/lib/workspace'
import { RemoveButton } from './ActivityForm'

function chainAddressSyncKey(accountId: string) {
  return ['chain-address-sync', accountId] as const
}

const chainLabel: Record<Chain, string> = {
  btc: 'Bitcoin',
  ltc: 'Litecoin',
  eth: 'Ethereum',
  bnb: 'BNB Chain',
  xrp: 'XRP',
  xlm: 'Stellar',
}

function formatSyncAt(value?: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ChainAddressForm({
  accountId,
  addresses,
}: {
  accountId: string
  addresses: Array<{ id: string; chain: string; address: string; lastSyncAt?: string | null }>
}) {
  const invalidate = useInvalidateWorkspace()
  const add = useMutation({
    mutationFn: (input: { chain: Chain; address: string }) => api.createChainAddress(accountId, input),
    onSuccess: () => invalidate(),
  })
  const remove = useMutation({
    mutationFn: (addressId: string) => api.deleteChainAddress(accountId, addressId),
    onSuccess: () => invalidate(),
  })
  const syncKey = chainAddressSyncKey(accountId)
  const sync = useMutation({
    mutationKey: syncKey,
    mutationFn: (addressId: string) => api.syncChainAddress(accountId, addressId),
    onSuccess: () => invalidate(),
  })
  const pendingSyncIds = useMutationState({
    filters: { mutationKey: syncKey, status: 'pending' },
    select: (mutation) => mutation.state.variables as string | undefined,
  })

  return (
    <Card className="mt-6">
      <h2 className="m-0 text-base font-semibold">Watched addresses</h2>
      <p className="mt-2 mb-0 text-sm text-muted">
        Public receive addresses or HD xpub/ypub/zpub. Do not paste a seed phrase or private key.
      </p>
      {addresses.length > 0 ? (
        <DataTable
          columns={[
            { key: 'chain', label: 'Chain' },
            { key: 'address', label: 'Address' },
            { key: 'synced', label: 'Last fetch' },
            { key: 'actions', label: '', align: 'right' },
          ]}
        >
          {addresses.map((row) => (
            <Row key={row.id}>
              <Cell>{chainLabel[row.chain as Chain] ?? row.chain}</Cell>
              <Cell className="num break-all">{row.address}</Cell>
              <Cell muted>{formatSyncAt(row.lastSyncAt)}</Cell>
              <Cell align="right">
                <span className="inline-flex items-center gap-3">
                  <GhostButton
                    disabled={pendingSyncIds.includes(row.id)}
                    onClick={() => sync.mutate(row.id)}
                  >
                    {pendingSyncIds.includes(row.id) ? 'Fetching…' : 'Fetch transactions'}
                  </GhostButton>
                  <RemoveButton
                    onRemove={() => remove.mutate(row.id)}
                    pending={remove.isPending}
                  />
                </span>
              </Cell>
            </Row>
          ))}
        </DataTable>
      ) : (
        <p className="mt-4 mb-0 text-sm text-muted">No addresses watched yet.</p>
      )}
      <form
        className="mt-5 grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          add.mutate(
            {
              chain: String(data.get('chain') ?? 'btc') as Chain,
              address: String(data.get('address') ?? ''),
            },
            { onSuccess: () => form.reset() },
          )
        }}
      >
        <FormField label="Chain">
          <SelectInput name="chain" defaultValue="btc">
            {CHAINS.map((chain) => (
              <option key={chain} value={chain}>
                {chainLabel[chain]}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField
          label="Address"
          hint="One address, or an Exodus xpub/zpub. Native SegWit and Taproot are separate zpubs."
        >
          <TextInput name="address" required placeholder="bc1q…, xpub…, or zpub…" spellCheck={false} />
        </FormField>
        <div>
          <PrimaryButton type="submit" disabled={add.isPending}>
            {add.isPending ? 'Adding…' : 'Watch address'}
          </PrimaryButton>
        </div>
      </form>
      <FormError
        message={
          add.isError
            ? mutationError(add.error)
            : remove.isError
              ? mutationError(remove.error)
              : sync.isError
                ? mutationError(sync.error)
                : undefined
        }
      />
      {sync.isSuccess ? (
        <p className="mt-3 mb-0 text-sm text-muted">
          Fetched {sync.data.fetchedCount}, imported {sync.data.importedCount} new, skipped{' '}
          {sync.data.skippedCount} already stored.
        </p>
      ) : null}
    </Card>
  )
}
