import { createClient } from 'client-api-sdk'

export const api = createClient({
  baseUrl: import.meta.env.VITE_API_URL as string | undefined,
})
