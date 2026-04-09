import * as dotenv from 'dotenv';
import { db, client } from './src/db';
import { users, brands, models } from './src/db/schema';

dotenv.config();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await db.execute('SELECT 1');
    console.log('✅ Database connection successful!\n');

    console.log('Testing brands table...');
    try {
      const brandList = await client`SELECT * FROM brands LIMIT 5`;
      console.log('✅ Brands table exists! Count:', brandList.length);
      console.log('Sample:', brandList[0]);
    } catch (err: any) {
      console.error('❌ Error querying brands:', err.message);
    }

    console.log('\nTesting models table...');
    try {
      const modelList = await client`SELECT * FROM models LIMIT 5`;
      console.log('✅ Models table exists! Count:', modelList.length);
    } catch (err: any) {
      console.error('❌ Error querying models:', err.message);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
