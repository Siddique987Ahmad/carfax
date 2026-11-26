CREATE TABLE "car_duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"car_id" uuid NOT NULL,
	"other_car_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "car_duplicate_candidates_not_self" CHECK ("car_duplicate_candidates"."car_id" <> "car_duplicate_candidates"."other_car_id")
);
--> statement-breakpoint
ALTER TABLE "car_duplicate_candidates" ADD CONSTRAINT "car_duplicate_candidates_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_duplicate_candidates" ADD CONSTRAINT "car_duplicate_candidates_other_car_id_cars_id_fk" FOREIGN KEY ("other_car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "car_duplicate_candidates_open_pair" ON "car_duplicate_candidates" USING btree (least("car_id", "other_car_id"),greatest("car_id", "other_car_id")) WHERE "car_duplicate_candidates"."resolved_at" IS NULL;