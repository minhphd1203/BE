-- Add missing transaction columns if they don't exist
-- This is a safe migration that only adds columns, doesn't drop anything

DO $$ 
BEGIN
  -- Add system_fee if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'system_fee') THEN
    ALTER TABLE transactions ADD COLUMN system_fee double precision DEFAULT 0 NOT NULL;
    CREATE INDEX idx_transactions_system_fee ON transactions(system_fee);
  END IF;

  -- Add seller_net_amount if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'seller_net_amount') THEN
    ALTER TABLE transactions ADD COLUMN seller_net_amount double precision DEFAULT 0 NOT NULL;
  END IF;

  -- Add original_bike_price if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'original_bike_price') THEN
    ALTER TABLE transactions ADD COLUMN original_bike_price double precision;
  END IF;

  -- Add buyer_phone if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'buyer_phone') THEN
    ALTER TABLE transactions ADD COLUMN buyer_phone varchar(20);
  END IF;

  -- Add buyer_email if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'buyer_email') THEN
    ALTER TABLE transactions ADD COLUMN buyer_email varchar(255);
  END IF;

  RAISE NOTICE 'Migration completed: All missing transaction columns have been added';
END $$;
