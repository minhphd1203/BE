import { db } from './src/db/index';
import { sql } from 'drizzle-orm';

async function checkSystemFeeColumns() {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='transactions' 
      AND column_name IN ('system_fee', 'seller_net_amount', 'original_bike_price')
      ORDER BY column_name;
    `);
    
    console.log('System Fee Columns in Database:');
    console.log(result.rows);
    
    if (result.rows.length === 3) {
      console.log('\n✅ SUCCESS: All system fee columns exist!');
    } else {
      console.log(`\n❌ ERROR: Only ${result.rows.length}/3 columns found`);
    }
  } catch (error) {
    console.error('Query failed:', error);
  }
  process.exit(0);
}

checkSystemFeeColumns();
