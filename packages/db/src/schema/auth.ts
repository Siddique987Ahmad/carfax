import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './columns';
import { users } from './users';

/** Which app a session belongs to (api/03). `admin` is added with admin login (admin/04). */
export const authAudience = pgEnum('auth_audience', ['garage', 'web']);

/**
 * Refresh tokens (api/03). Only a SHA-256 hash is stored, never the token. Each use replaces the
 * token with a new one in the same family; reusing an old token outside the short retry grace
 * period revokes the whole family, because it means the token was copied.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** One sign-in on one device; every rotation stays in the family. */
    familyId: uuid().notNull(),
    audience: authAudience().notNull(),
    tokenHash: text().notNull().unique('refresh_tokens_token_hash_unique'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Set when rotated (with replacedById), signed out, or revoked as a family. */
    revokedAt: timestamp({ withTimezone: true }),
    replacedById: uuid(),
    /** When the token was last exchanged; a replacement that was never used allows a retry. */
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check('refresh_tokens_hash_format', sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
    index().on(t.familyId),
    index().on(t.userId),
  ],
);
