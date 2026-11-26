import { bigint, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './columns';
import { users } from './users';

/**
 * Every change made by the team or the system that matters later: approvals, corrections, merges,
 * refunds, role changes. The app's database user can add and read rows but never change or delete
 * them (db/06), so the log can be trusted in disputes.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    /** Who did it; null for the system (workers, automatic checks). */
    actorId: uuid().references(() => users.id),
    /** What happened, e.g. 'garage.approve', 'job.reject', 'car.merge'. */
    action: text().notNull(),
    /** The kind of record changed, e.g. 'garage', 'job', 'car'. */
    entity: text().notNull(),
    entityId: uuid(),
    /** Why: the admin plans require a reason for every change. */
    note: text(),
    before: jsonb(),
    after: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entity, t.entityId, t.createdAt), index().on(t.actorId, t.createdAt)],
);
