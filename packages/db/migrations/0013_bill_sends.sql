CREATE TABLE "bill_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"garage_id" uuid NOT NULL,
	"sent_by" uuid NOT NULL,
	"method" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_sends_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "bill_sends_method" CHECK ("bill_sends"."method" IN ('wa_me', 'cloud_api')),
	CONSTRAINT "bill_sends_hash_format" CHECK ("bill_sends"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "bill_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bill_sends" ADD CONSTRAINT "bill_sends_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sends" ADD CONSTRAINT "bill_sends_job_same_garage_fk" FOREIGN KEY ("job_id","garage_id") REFERENCES "public"."jobs"("id","garage_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_sends_job_id_created_at_index" ON "bill_sends" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE POLICY "bill_sends_garage_isolation" ON "bill_sends" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.scope', true) = 'system' OR "bill_sends"."garage_id" = nullif(current_setting('app.garage_id', true), '')::uuid) WITH CHECK (current_setting('app.scope', true) = 'system' OR "bill_sends"."garage_id" = nullif(current_setting('app.garage_id', true), '')::uuid);