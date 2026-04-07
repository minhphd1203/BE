import { client } from '../src/db';
import dotenv from 'dotenv';

dotenv.config();

async function addBankColumns() {
  try {
    console.log('Checking for bank columns...');
    
    try {
      await client`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS bank_account_number varchar(50),
        ADD COLUMN IF NOT EXISTS bank_account_holder varchar(255),
        ADD COLUMN IF NOT EXISTS bank_code varchar(10),
        ADD COLUMN IF NOT EXISTS bank_branch varchar(100)
      `;
      console.log('✓ Bank columns added successfully');
    } catch (err: any) {
      console.error('Error adding columns:', err.message);
    }

    // Verify columns exist
    const userColumns = await client`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name LIKE 'bank%'
      ORDER BY ordinal_position
    `;
    console.log('✓ Bank columns in database:', userColumns.length > 0 ? 'CONFIRMED' : 'MISSING');
    userColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

addBankColumns();
