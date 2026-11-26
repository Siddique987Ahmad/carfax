import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { createInsertSchema, createSelectSchema } from './zod';

// A test-only table: the real tables (and their exported schemas) start in db/02.
const example = pgTable('example', {
  id: uuid().primaryKey().defaultRandom(),
  regNo: text().notNull(),
  odometerKm: integer().notNull(),
  notes: text(),
});

describe('Zod schemas from tables', () => {
  const insert = createInsertSchema(example);

  it('accepts a valid row and leaves out columns with defaults', () => {
    expect(insert.parse({ regNo: 'LEA1234', odometerKm: 84250 })).toEqual({
      regNo: 'LEA1234',
      odometerKm: 84250,
    });
  });

  it('rejects a missing required column or a wrong type', () => {
    expect(insert.safeParse({ regNo: 'LEA1234' }).success).toBe(false);
    expect(insert.safeParse({ regNo: 'LEA1234', odometerKm: '84,250' }).success).toBe(false);
  });

  it('select schemas mark nullable columns as nullable', () => {
    const select = createSelectSchema(example);
    expect(
      select.safeParse({ id: crypto.randomUUID(), regNo: 'X1', odometerKm: 1, notes: null })
        .success,
    ).toBe(true);
  });
});
