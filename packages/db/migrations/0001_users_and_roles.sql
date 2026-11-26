CREATE TYPE "public"."platform_role" AS ENUM('buyer', 'dealer', 'car_owner', 'admin', 'ops', 'support');--> statement-breakpoint
CREATE TABLE "admin_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "platform_role" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(13) NOT NULL,
	"name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_phone_format" CHECK ("users"."phone" ~ '^\+923[0-9]{9}$'),
	CONSTRAINT "users_totp_needs_secret" CHECK ("users"."totp_enabled_at" IS NULL OR "users"."totp_secret_enc" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_recovery_codes_user_id_index" ON "admin_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_index" ON "user_roles" USING btree ("role");