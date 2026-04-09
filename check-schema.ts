import * as dotenv from 'dotenv';
import { client } from './src/db';

dotenv.config();

async function checkSchema() {
  try {
    console.log('Checking bikes table schema...\n');
    
   const columns = await client`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bikes'
      ORDER BY ordinal_position;
    `;
    
    console.log('Bikes table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
