import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  PROCESSOR_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().optional(),
  DRAGONFLY_URL: z.string().default('redis://localhost:6379'),
  API_PREFIX: z.string().default('v1'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATA_DIR: z.string().default('data/documents'),
  ETHERSCAN_API_KEY: z.string().optional(),
  STELLAR_HORIZON_URL: z.string().optional(),
  BLOCKDAEMON_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
