import { useMutation } from '@tanstack/react-query'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatementOverlapError } from 'client-api-sdk'
import { api } from '@/api/client'
import { FormError } from '@/components/ui/FormField'
import { GhostButton, PrimaryButton } from '@/components/ui/PageHeader'
import { mutationError, useInvalidateWorkspace } from '@/lib/workspace'

export function StatementUpload({
  variant = 'primary',
  kind = 'card',
}: {
  variant?: 'primary' | 'ghost'
  kind?: 'card' | 'bank'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const invalidate = useInvalidateWorkspace()
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      try {
        return kind === 'bank'
          ? await api.importBankStatement({ file })
          : await api.importCardStatement({ file })
      } catch (error) {
        if (error instanceof StatementOverlapError) {
          const replace = window.confirm(
            `${error.message} Replace the overlapping activity with this statement?`,
          )
          if (!replace) throw error
          return kind === 'bank'
            ? api.importBankStatement({ file, confirm: 'replace' })
            : api.importCardStatement({ file, confirm: 'replace' })
        }
        throw error
      }
    },
    onSuccess: async (result) => {
      await invalidate()
      if ('accounts' in result) {
        const first = result.accounts[0]
        navigate(
          result.accounts.length === 1 && first
            ? `/statements/${first.accountId}`
            : '/statements',
        )
        return
      }
      navigate(`/cards/${result.accountId}`)
    },
  })

  const Button = variant === 'ghost' ? GhostButton : PrimaryButton
  const label = mutation.isPending ? 'Reading statement…' : 'Upload statement'

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) mutation.mutate(file)
        }}
      />
      <Button disabled={mutation.isPending} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      {mutation.isError && !(mutation.error instanceof StatementOverlapError) ? (
        <FormError message={mutationError(mutation.error)} />
      ) : null}
    </div>
  )
}
