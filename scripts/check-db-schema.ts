import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function checkDB() {
  try {
    console.log('🔍 Checking database schema...\n');

    // Check if inspection_status column exists
    const columns:any = await db.execute(sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'bikes' 
      ORDER BY ordinal_position
    `);

    console.log('📋 Bikes table columns:');
    console.table(columns);

    // Check if inspections table exists
    const tables:any = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('bikes', 'inspections', 'users')
    `);

    console.log('\n📊 Tables in database:');
    console.table(tables);

    // Count bikes
    const bikeCount:any = await db.execute(sql`SELECT COUNT(*) FROM bikes`);
    console.log('\n🚲 Total bikes:', bikeCount[0].count);

    // Count inspectors
    const inspectorCount:any = await db.execute(sql`SELECT COUNT(*) FROM users WHERE role = 'inspector'`);
    console.log('👤 Total inspectors:', inspectorCount[0].count);

  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

checkDB();
