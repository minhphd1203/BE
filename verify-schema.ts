import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function verifySchema() {
  try {
    console.log('✅ DATABASE SCHEMA VERIFICATION\n');

    // Check users table columns
    const usersColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('👤 Users table columns:');
    (usersColumns as any).forEach((col: any) => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type}`);
    });

    // Get all tables
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📊 All tables in database:');
    (tables as any).forEach((t: any) => console.log(`  ✓ ${t.table_name}`));

    // Check deliveries table
    console.log('\n🚚 Checking deliveries table columns:');
    const deliveriesColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'deliveries' 
      ORDER BY ordinal_position
    `);
    (deliveriesColumns as any).forEach((col: any) => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type}`);
    });

    // Check transactions table
    console.log('\n💳 Checking transactions table columns:');
    const transColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      ORDER BY ordinal_position
    `);
    (transColumns as any).forEach((col: any) => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type}`);
    });

    // Check payouts table
    console.log('\n💰 Checking payouts table columns:');
    const payoutsColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'payouts' 
      ORDER BY ordinal_position
    `);
    (payoutsColumns as any).forEach((col: any) => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type}`);
    });

    // Verify bank columns in users
    console.log('\n🏦 Bank columns in users:');
    const bankCols = (usersColumns as any).filter((c: any) => c.column_name.includes('bank'));
    if (bankCols.length === 4) {
      bankCols.forEach((col: any) => console.log(`  ✓ ${col.column_name}`));
    } else {
      console.log(`  ❌ Expected 4 bank columns, found ${bankCols.length}`);
    }

    // Verify delivery_id in transactions
    console.log('\n🔗 Foreign keys:');
    const fkCheck = await db.execute(sql`
      SELECT constraint_name, table_name, column_name
      FROM information_schema.constraint_column_usage
      WHERE table_name IN ('transactions', 'payouts', 'deliveries')
        AND column_name LIKE '%_id' OR column_name LIKE '%_fk'
    `);
    console.log(`  ✓ Found ${(fkCheck as any).length} foreign key references`);

    console.log('\n✅ Schema verification complete!');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

verifySchema();
