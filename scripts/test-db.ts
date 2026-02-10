import { db } from '../src/db';
import { users, bikes } from '../src/db/schema';

async function testConnection() {
  try {
    console.log('Testing Drizzle ORM connection...\n');
    
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
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing connection:', error);
    process.exit(1);
  }
}

testConnection();
