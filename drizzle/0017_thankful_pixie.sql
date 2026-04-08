CREATE TABLE IF NOT EXISTS "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_status" varchar(50) DEFAULT 'preparing' NOT NULL,
	"delivery_notes" text,
	"receipt_confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"amount" double precision NOT NULL,
	"bank_account_number" varchar(50) NOT NULL,
	"bank_account_holder" varchar(255) NOT NULL,
	"bank_code" varchar(10) NOT NULL,
	"bank_branch" varchar(100),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payout_at" timestamp,
	"completed_at" timestamp,
	"external_payout_id" varchar(100),
	"provider_transaction_id" varchar(100),
	"failure_reason" text,
	"webhook_received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_external_payout_id_unique" UNIQUE("external_payout_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_threads" ALTER COLUMN "bike_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "buyer_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "buyer_email" varchar(255);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_account_number" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_account_holder" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_code" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_branch" varchar(100);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT constraint_name FROM information_schema.constraint_column_usage WHERE table_name='payouts' AND constraint_name='payouts_transaction_id_transactions_id_fk') THEN
    ALTER TABLE "payouts" ADD CONSTRAINT "payouts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
END$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT constraint_name FROM information_schema.constraint_column_usage WHERE table_name='payouts' AND constraint_name='payouts_seller_id_users_id_fk') THEN
    ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
END$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT constraint_name FROM information_schema.constraint_column_usage WHERE table_name='transactions' AND constraint_name='transactions_delivery_id_deliveries_id_fk') THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;
  END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
END$$;--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_status";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_notes";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivered_at";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "receipt_confirmed_at";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_updated_at";