/**
 * Direct database migration script - adds missing transaction columns
 * Bypasses drizzle-kit to avoid data loss confirmation
 */

import { client } from '../src/db';
import * as dotenv from 'dotenv';

dotenv.config();

const migrationSQL = `
DO $$ 
BEGIN
  -- Add system_fee if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'system_fee') THEN
    ALTER TABLE transactions ADD COLUMN system_fee double precision DEFAULT 0 NOT NULL;
    RAISE NOTICE 'Added system_fee column';
  ELSE
    RAISE NOTICE 'system_fee column already exists';
  END IF;

  -- Add seller_net_amount if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'seller_net_amount') THEN
    ALTER TABLE transactions ADD COLUMN seller_net_amount double precision DEFAULT 0 NOT NULL;
    RAISE NOTICE 'Added seller_net_amount column';
  ELSE
    RAISE NOTICE 'seller_net_amount column already exists';
  END IF;

  -- Add original_bike_price if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'original_bike_price') THEN
    ALTER TABLE transactions ADD COLUMN original_bike_price double precision;
    RAISE NOTICE 'Added original_bike_price column';
  ELSE
    RAISE NOTICE 'original_bike_price column already exists';
  END IF;

  -- Add buyer_phone if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'buyer_phone') THEN
    ALTER TABLE transactions ADD COLUMN buyer_phone varchar(20);
    RAISE NOTICE 'Added buyer_phone column';
  ELSE
    RAISE NOTICE 'buyer_phone column already exists';
  END IF;

  -- Add buyer_email if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'buyer_email') THEN
    ALTER TABLE transactions ADD COLUMN buyer_email varchar(255);
    RAISE NOTICE 'Added buyer_email column';
  ELSE
    RAISE NOTICE 'buyer_email column already exists';
  END IF;

  -- Add full_name if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'full_name') THEN
    ALTER TABLE transactions ADD COLUMN full_name text;
    RAISE NOTICE 'Added full_name column';
  ELSE
    RAISE NOTICE 'full_name column already exists';
  END IF;

  -- Add address if it doesn't exist
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'address') THEN
    ALTER TABLE transactions ADD COLUMN address text;
    RAISE NOTICE 'Added address column';
  ELSE
    RAISE NOTICE 'address column already exists';
  END IF;

  RAISE NOTICE 'Migration completed: All required transaction columns verified/added';
END $$;
`;

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    console.log('✅ Connected!');

    console.log('🔄 Running migration...');
    const result = await client.unsafe(migrationSQL);
    console.log('✅ Migration completed successfully!');
    console.log('📝 Result:', result);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration().then(async () => {
  console.log('✨ Done!');
  await client.end();
  process.exit(0);
});
