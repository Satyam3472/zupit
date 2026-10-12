ALTER TABLE "customers" ADD COLUMN "block_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bill_total" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "final_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "created_by_admin_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "id_proof_url" text;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "block_reason" text;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "is_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;