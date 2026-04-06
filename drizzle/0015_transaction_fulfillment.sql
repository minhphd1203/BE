ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_status" varchar(50);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_notes" text;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "receipt_confirmed_at" timestamp;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_updated_at" timestamp;
