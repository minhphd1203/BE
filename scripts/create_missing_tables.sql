-- Create deliveries table if it doesn't exist
CREATE TABLE IF NOT EXISTS "deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "delivery_status" varchar(50) NOT NULL DEFAULT 'preparing',
  "delivery_notes" text,
  "receipt_confirmed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create payouts table if it doesn't exist
CREATE TABLE IF NOT EXISTS "payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "amount" double precision NOT NULL,
  "bank_account_number" varchar(50) NOT NULL,
  "bank_account_holder" varchar(255) NOT NULL,
  "bank_code" varchar(10) NOT NULL,
  "bank_branch" varchar(100),
  "status" varchar(50) NOT NULL DEFAULT 'pending',
  "payout_at" timestamp,
  "completed_at" timestamp,
  "external_payout_id" varchar(100) UNIQUE,
  "provider_transaction_id" varchar(100),
  "failure_reason" text,
  "webhook_received_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id"),
  FOREIGN KEY ("seller_id") REFERENCES "users"("id")
);

-- Add delivery_id column to transactions if it doesn't exist
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_id" uuid;

-- Add delivery_id foreign key to transactions if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'transactions' AND constraint_name = 'transactions_delivery_id_deliveries_id_fk'
  ) THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_delivery_id_deliveries_id_fk" 
      FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id");
  END IF;
END $$;

-- Add created_at and updated_at triggers for deliveries if they don't exist
CREATE OR REPLACE FUNCTION update_updated_at_deliveries()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_deliveries();

-- Add created_at and updated_at triggers for payouts
CREATE OR REPLACE FUNCTION update_updated_at_payouts()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payouts_updated_at ON payouts;
CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON payouts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_payouts();
