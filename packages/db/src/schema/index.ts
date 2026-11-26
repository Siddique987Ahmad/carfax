// All tables, one file per area, re-exported here.
// After changing a table, run `pnpm db:generate`, read the SQL, and commit it with the change.
export * from './users';
export * from './garages';
export * from './cars';
export * from './jobs';
export * from './audit';
