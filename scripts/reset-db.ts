import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

async function resetDatabase() {
  try {
    console.log('Dropping all tables...');
    
    // Drop tables if exists
    await sql`DROP TABLE IF EXISTS bikes CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    await sql`DROP TABLE IF EXISTS "User" CASCADE`;
    await sql`DROP TABLE IF EXISTS "Bike" CASCADE`;
    
    console.log('✓ All tables dropped successfully');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    await sql.end();
  }
}

resetDatabase();
