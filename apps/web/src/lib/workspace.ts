import { useQueryClient } from '@tanstack/react-query'

export function todayInput(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

export function dateInputValue(iso: string | null | undefined): string {
  return iso?.slice(0, 10) ?? ''
}

export function mutationError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function useInvalidateWorkspace() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}
