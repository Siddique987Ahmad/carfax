import { afterEach, describe, expect, it } from 'vitest';
import { getConfig, resetConfigForTests } from '../src/config';

const base = {
  DATABASE_URL: 'postgres://carfax_app:x@localhost/carfax',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'x'.repeat(32),
  OTP_SECRET: 'y'.repeat(32),
};

describe('config', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetConfigForTests();
  });
  const load = (env: Record<string, string>) => {
    process.env = { ...saved, ...base, ...env };
    resetConfigForTests();
    return getConfig();
  };

  it('production refuses the console and memory messaging providers', () => {
    expect(() => load({ NODE_ENV: 'production', MESSAGING_PROVIDER: 'console' })).toThrow(
      /MESSAGING_PROVIDER/,
    );
    expect(() => load({ NODE_ENV: 'production', MESSAGING_PROVIDER: 'memory' })).toThrow(
      /MESSAGING_PROVIDER/,
    );
  });

  it('refuses short secrets', () => {
    expect(() => load({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it("refuses the migration owner's connection as DATABASE_URL", () => {
    expect(() =>
      load({ MIGRATION_DATABASE_URL: base.DATABASE_URL, NODE_ENV: 'development' }),
    ).toThrow(/row-level security/);
  });
});
