-- Hand-written: drizzle-kit can't create functions or triggers.
-- set_updated_at() keeps updated_at correct on every UPDATE, however the row was changed
-- (API, worker, admin edit or raw SQL). Sync pulls (api/09) depend on it.
-- Every new table with an updated_at column must get the same trigger in its own migration.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER garages_set_updated_at BEFORE UPDATE ON garages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
