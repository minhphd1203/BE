import { db } from '../src/db';
import { users } from '../src/db/schema';

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    const result = await db.select().from(users).limit(1);
    console.log('✅ Database connection successful!');
    console.log('Users table accessible:', result.length, 'rows');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error instanceof Error ? error.message : error);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testConnection();
