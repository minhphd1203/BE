import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { client } from './src/db';

dotenv.config();

async function addMissingColumns() {
  try {
    console.log('Adding missing bank account columns to users table...\n');
    
    // List of ALTER TABLE statements to add the missing columns
    const statements = [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_account_number" varchar(50);`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_account_holder" varchar(255);`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_code" varchar(10);`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_branch" varchar(100);`
    ];
    
    for (const stmt of statements) {
      try {
        await client.unsafe(stmt);
        console.log(`✅ ${stmt}`);
      } catch (err: any) {
        console.log(`⚠️  ${stmt}`);
        console.log(`   Error: ${err.message}\n`);
      }
    }
    
    console.log('\n✅ Column migration complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addMissingColumns();
