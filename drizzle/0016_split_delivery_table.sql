-- Create deliveries table (simplified - only columns that exist in current schema)
CREATE TABLE IF NOT EXISTS "deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "delivery_status" varchar(50) NOT NULL DEFAULT 'preparing',
  "delivery_notes" text,
  "receipt_confirmed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Add delivery_id FK to transactions
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_id" uuid;

-- Create FK constraint (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name='transactions' AND constraint_name='transactions_delivery_id_fk'
  ) THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_delivery_id_fk" 
      FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id");
  END IF;
END$$;

-- Migrate existing delivery data - only if columns exist
DO $$
DECLARE
  has_delivery_status BOOLEAN;
BEGIN
  -- Check if delivery_status column exists in transactions
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='transactions' AND column_name='delivery_status'
  ) INTO has_delivery_status;
  
  -- Only run migration if the column exists
  IF has_delivery_status THEN
    INSERT INTO "deliveries" ("id", "delivery_status", "delivery_notes", "receipt_confirmed_at", "created_at", "updated_at")
    SELECT 
      gen_random_uuid(),
      COALESCE("delivery_status", 'preparing'),
      "delivery_notes",
      "receipt_confirmed_at",
      now(),
      now()
    FROM "transactions"
    WHERE "delivery_status" IS NOT NULL OR "delivery_notes" IS NOT NULL OR "receipt_confirmed_at" IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Drop old delivery columns from transactions (if they exist)
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_status";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_notes";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivered_at";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "receipt_confirmed_at";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_updated_at";
