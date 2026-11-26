import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// Locally, read the repo's .env (pnpm env:init). Real environments pass variables directly.
const envFile = join(__dirname, '../../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(envFile)) process.loadEnvFile(envFile);

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    /** The app's database user, carfax_app (db/06). Never the table owner. */
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.url(),
    /** Empty locally: Sentry is off. */
    SENTRY_DSN: z.union([z.literal(''), z.url()]).default(''),
    /** Only to check the app isn't given the owner's connection by mistake. */
    MIGRATION_DATABASE_URL: z.url().optional(),
  })
  .refine((c) => c.DATABASE_URL !== c.MIGRATION_DATABASE_URL, {
    message:
      'DATABASE_URL must be the app user (carfax_app), not the migration owner: the owner bypasses row-level security',
    path: ['DATABASE_URL'],
  });

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | undefined;

/** Reads and checks the environment once. A missing or wrong value stops the API at startup. */
export function getConfig(): Config {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`The API's environment is incomplete or wrong:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}
