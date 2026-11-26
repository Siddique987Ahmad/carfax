-- Edited by hand: the jobs unique constraint is moved first (the foreign key below needs it),
-- and the updated_at trigger is added at the end.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_id_garage_unique" UNIQUE("id","garage_id");--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('open', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "job_correction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"garage_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"message" text NOT NULL,
	"proposed" jsonb,
	"status" "correction_status" DEFAULT 'open' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_correction_requests_message_length" CHECK (char_length("job_correction_requests"."message") BETWEEN 3 AND 1000),
	CONSTRAINT "job_correction_requests_decided" CHECK (("job_correction_requests"."status" = 'open') = ("job_correction_requests"."decided_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "job_correction_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_correction_requests" ADD CONSTRAINT "job_correction_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_correction_requests" ADD CONSTRAINT "job_correction_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_correction_requests" ADD CONSTRAINT "job_correction_requests_job_same_garage_fk" FOREIGN KEY ("job_id","garage_id") REFERENCES "public"."jobs"("id","garage_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_correction_requests_one_open" ON "job_correction_requests" USING btree ("job_id") WHERE "job_correction_requests"."status" = 'open';--> statement-breakpoint
CREATE INDEX "job_correction_requests_garage_id_updated_at_index" ON "job_correction_requests" USING btree ("garage_id","updated_at");--> statement-breakpoint
CREATE INDEX "job_correction_requests_status_created_at_index" ON "job_correction_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE POLICY "job_correction_requests_garage_isolation" ON "job_correction_requests" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.scope', true) = 'system' OR "job_correction_requests"."garage_id" = nullif(current_setting('app.garage_id', true), '')::uuid) WITH CHECK (current_setting('app.scope', true) = 'system' OR "job_correction_requests"."garage_id" = nullif(current_setting('app.garage_id', true), '')::uuid);
--> statement-breakpoint
CREATE TRIGGER job_correction_requests_set_updated_at BEFORE UPDATE ON job_correction_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
