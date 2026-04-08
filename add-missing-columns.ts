import { db } from './src/db/index';
import { sql } from 'drizzle-orm';

async function addMissingColumns() {
  try {
    console.log('Adding missing system fee columns to transactions table...\n');
    
    // Add system_fee column
    try {
      await db.execute(sql`
        ALTER TABLE "transactions" ADD COLUMN "system_fee" double precision DEFAULT 0 NOT NULL;
      `);
      console.log('✅ Added system_fee column');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('⚠️  system_fee column already exists');
      } else {
        throw e;
      }
    }

    // Add seller_net_amount column
    try {
      await db.execute(sql`
        ALTER TABLE "transactions" ADD COLUMN "seller_net_amount" double precision DEFAULT 0 NOT NULL;
      `);
      console.log('✅ Added seller_net_amount column');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('⚠️  seller_net_amount column already exists');
      } else {
        throw e;
      }
    }

    // Add original_bike_price column
    try {
      await db.execute(sql`
        ALTER TABLE "transactions" ADD COLUMN "original_bike_price" double precision;
      `);
      console.log('✅ Added original_bike_price column');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('⚠️  original_bike_price column already exists');
      } else {
        throw e;
      }
    }

    console.log('\n✅ All columns added successfully!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

addMissingColumns();
