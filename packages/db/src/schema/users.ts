import { PLATFORM_ROLES } from '@carfax/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns';

/** Platform-wide roles (db/02). Garage roles (owner, mechanic) live in garage_members (db/03). */
export const platformRole = pgEnum('platform_role', PLATFORM_ROLES);

/** Everyone who logs in: garage staff, buyers, dealers, car owners and the team. */
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** The login. Always '+923XXXXXXXXX' (normalisePakistanMobile in @carfax/shared). */
    phone: varchar({ length: 13 }).notNull().unique(),
    name: text(),
    /** Inactive users can't log in (admin/04, admin/14). */
    isActive: boolean().notNull().default(true),
    /** Authenticator-app secret, encrypted by the API before saving; never stored in plain text (admin/05). */
    totpSecretEnc: text(),
    totpEnabledAt: timestamp({ withTimezone: true }),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('users_phone_format', sql`${t.phone} ~ '^\\+923[0-9]{9}$'`),
    check(
      'users_totp_needs_secret',
      sql`${t.totpEnabledAt} IS NULL OR ${t.totpSecretEnc} IS NOT NULL`,
    ),
  ],
);

/** Platform roles held by a user; one person can hold several (e.g. buyer and car_owner). */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: platformRole().notNull(),
    /** Who granted it: a team member, or null when the system granted it (e.g. first login as a buyer). */
    grantedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] }), index().on(t.role)],
);

/** One-time recovery codes for the admin second factor, stored hashed (admin/05). */
export const adminRecoveryCodes = pgTable(
  'admin_recovery_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text().notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);
