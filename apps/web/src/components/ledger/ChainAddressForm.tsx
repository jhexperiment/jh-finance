import { useMutation, useMutationState } from '@tanstack/react-query'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
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

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function WatchedAddress({ address }: { address: string }) {
  const tipRef = useRef<HTMLDivElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [tip, setTip] = useState<{ left: number; top: number; triggerTop: number } | null>(
    null,
  )
  const [copyTitle, setCopyTitle] = useState('Copy address')
  const [copyTone, setCopyTone] = useState<'muted' | 'gain' | 'loss'>('muted')

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return
    const d = tipRef.current
    const left = Math.max(8, Math.min(tip.left, window.innerWidth - d.offsetWidth - 8))
    let top = tip.top
    if (top + d.offsetHeight > window.innerHeight - 8) {
      top = Math.max(8, tip.triggerTop - d.offsetHeight - 6)
    }
    d.style.left = `${left}px`
    d.style.top = `${top}px`
  }, [tip])

  useEffect(() => {
    if (!tip) return
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [tip])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  function showTip(event: MouseEvent<HTMLSpanElement>) {
    const r = event.currentTarget.getBoundingClientRect()
    setTip({ left: r.left, top: r.bottom + 6, triggerTop: r.top })
  }

  function markCopy(ok: boolean) {
    setCopyTone(ok ? 'gain' : 'loss')
    setCopyTitle(ok ? 'Copied' : 'Copy failed')
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => {
      setCopyTone('muted')
      setCopyTitle('Copy address')
    }, 1200)
  }

  const toneClass =
    copyTone === 'gain' ? 'text-gain' : copyTone === 'loss' ? 'text-loss' : 'text-muted'

  return (
    <div className="flex w-[260px] max-w-full items-center gap-2">
      <span
        className="num min-w-0 flex-1 truncate text-[13px]"
        onMouseEnter={showTip}
        onMouseLeave={() => setTip(null)}
      >
        {address}
      </span>
      <button
        type="button"
        className={`grid size-[30px] shrink-0 place-items-center rounded-lg border border-line bg-white p-0 ${toneClass} ${copyTone === 'muted' ? 'hover:text-ink' : ''}`}
        aria-label="Copy address"
        title={copyTitle}
        onClick={() => {
          void copyText(address).then(markCopy)
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
      {tip
        ? createPortal(
            <div
              ref={tipRef}
              role="tooltip"
              className="pointer-events-none fixed z-50 max-w-[360px] rounded-[10px] border border-line bg-white px-2.5 py-2 text-xs leading-[1.4] break-all text-ink shadow-[0_6px_20px_rgba(26,29,33,.12)]"
              style={{ left: tip.left, top: tip.top }}
            >
              {address}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
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
              <Cell>
                <WatchedAddress address={row.address} />
              </Cell>
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
