import { z } from 'zod'

export const dragonflyEnvSchema = z.object({
  DRAGONFLY_URL: z.string().default('redis://localhost:6379'),
  DRAGONFLY_PORT: z.coerce.number().default(6379),
})

export type DragonflyEnv = z.infer<typeof dragonflyEnvSchema>
