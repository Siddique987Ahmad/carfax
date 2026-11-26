/**
 * Seeding and resetting can never touch production (db/08). Refuses when NODE_ENV is production or
 * the database name looks like production. A database that isn't on this machine (e.g. staging)
 * also needs SEED_ALLOW_REMOTE=true; reset only ever runs on this machine.
 */
export function assertSafeTarget(
  url: string,
  options: { reset?: boolean; env?: NodeJS.ProcessEnv } = {},
): void {
  const env = options.env ?? process.env;
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);

  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production');
  }
  if (/prod/i.test(database) || /prod/i.test(parsed.hostname)) {
    throw new Error(`Refusing to seed: "${database}" on ${parsed.hostname} looks like production`);
  }
  if (options.reset && !local) {
    throw new Error(
      `Refusing to reset: ${parsed.hostname} isn't this machine. Reset is local only`,
    );
  }
  if (!local && env.SEED_ALLOW_REMOTE !== 'true') {
    throw new Error(
      `Refusing to seed ${parsed.hostname}: it isn't this machine. Set SEED_ALLOW_REMOTE=true for staging`,
    );
  }
}
