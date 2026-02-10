import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import { users, bikes } from '../src/db/schema';

dotenv.config();

console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function testConnection() {
  try {
    console.log('\nTesting Drizzle ORM connection...\n');
    
    // Test selecting users
    console.log('Fetching users...');
    const allUsers = await db.select().from(users);
    console.log(`✓ Found ${allUsers.length} users`);
    
    // Test selecting bikes
    console.log('Fetching bikes...');
    const allBikes = await db.select().from(bikes);
    console.log(`✓ Found ${allBikes.length} bikes`);
    
    console.log('\n✓ Database connection successful!');
    console.log('✓ Drizzle ORM is working properly!');
    
  } catch (error) {
    console.error('Error testing connection:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

testConnection();
