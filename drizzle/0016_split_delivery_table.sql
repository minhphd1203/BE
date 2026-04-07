-- Create deliveries table
CREATE TABLE IF NOT EXISTS "deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "delivery_status" varchar(50) NOT NULL DEFAULT 'preparing',
  "delivery_notes" text,
  "delivered_at" timestamp,
  "receipt_confirmed_at" timestamp,
  "delivery_updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Add delivery_id FK to transactions
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_id" uuid;

-- Create FK constraint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_delivery_id_fk" 
  FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id");

-- Migrate existing delivery data - create delivery records and link them
INSERT INTO "deliveries" ("id", "delivery_status", "delivery_notes", "delivered_at", "receipt_confirmed_at", "delivery_updated_at", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  COALESCE("delivery_status", 'preparing'),
  "delivery_notes",
  "delivered_at",
  "receipt_confirmed_at",
  COALESCE("delivery_updated_at", now()),
  now(),
  now()
FROM "transactions"
WHERE "delivery_status" IS NOT NULL OR "delivery_notes" IS NOT NULL OR "delivered_at" IS NOT NULL OR "receipt_confirmed_at" IS NOT NULL;

-- Update transactions to link to their deliveries (for rows that had delivery data)
UPDATE "transactions" t
SET "delivery_id" = d.id
FROM "deliveries" d
WHERE t."delivery_status" = d.delivery_status
AND t."delivery_notes" IS NOT DISTINCT FROM d.delivery_notes
AND t."delivered_at" IS NOT DISTINCT FROM d.delivered_at
AND t."receipt_confirmed_at" IS NOT DISTINCT FROM d.receipt_confirmed_at
LIMIT 1;

-- Drop old delivery columns from transactions
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_status";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_notes";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivered_at";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "receipt_confirmed_at";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_updated_at";
