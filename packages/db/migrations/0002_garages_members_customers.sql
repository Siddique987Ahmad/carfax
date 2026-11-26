CREATE TYPE "public"."garage_role" AS ENUM('owner', 'mechanic');--> statement-breakpoint
CREATE TYPE "public"."garage_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garage_id" uuid NOT NULL,
	"name" text,
	"phone" varchar(13),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "customers_phone_format" CHECK ("customers"."phone" ~ '^\+923[0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE "garage_members" (
	"garage_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "garage_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garage_members_garage_id_user_id_pk" PRIMARY KEY("garage_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "garages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"status" "garage_status" DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"status_changed_at" timestamp with time zone,
	"trust_score" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garages_trust_score_range" CHECK ("garages"."trust_score" BETWEEN 0 AND 100),
	CONSTRAINT "garages_lat_range" CHECK ("garages"."lat" BETWEEN -90 AND 90),
	CONSTRAINT "garages_lng_range" CHECK ("garages"."lng" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garage_members" ADD CONSTRAINT "garage_members_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garage_members" ADD CONSTRAINT "garage_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garages" ADD CONSTRAINT "garages_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_garage_phone_unique" ON "customers" USING btree ("garage_id","phone") WHERE "customers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "customers_garage_id_updated_at_index" ON "customers" USING btree ("garage_id","updated_at");--> statement-breakpoint
CREATE INDEX "garage_members_user_id_index" ON "garage_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "garages_status_city_index" ON "garages" USING btree ("status","city");--> statement-breakpoint
CREATE INDEX "garages_owner_id_index" ON "garages" USING btree ("owner_id");