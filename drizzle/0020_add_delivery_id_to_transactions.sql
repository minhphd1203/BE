-- Add delivery_id column to transactions table
-- This links each transaction to its delivery record
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "delivery_id" uuid;

-- Add foreign key constraint from transactions to deliveries
-- (only if the constraint doesn't exist yet)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'transactions' 
    AND constraint_name = 'transactions_delivery_id_deliveries_id_fk'
  ) THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_delivery_id_deliveries_id_fk" 
      FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id");
  END IF;
END $$;
