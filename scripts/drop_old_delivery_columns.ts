import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function dropOldColumns() {
  try {
    console.log('🔄 Dropping old delivery columns from transactions table...');
    
    const columnsToDrop = [
      'delivery_status',
      'delivery_notes',
      'delivered_at',
      'receipt_confirmed_at',
      'delivery_updated_at',
    ];

    for (const col of columnsToDrop) {
      try {
        console.log(`  Dropping: ${col}`);
        await db.execute(
          sql.raw(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "${col}" CASCADE`)
        );
        console.log(`  ✓ Dropped: ${col}`);
      } catch (e) {
        console.log(`  ⚠️ Already dropped or error: ${col}`);
      }
    }

    console.log('\n✅ All old columns removed successfully!');
    console.log('\n🔍 Remaining columns in transactions table:');
    
    const result = await db.execute(
      sql.raw(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`
      )
    );

    // TypeScript doesn't know the structure
    const rows = result.rows as any[];
    rows.forEach(r => {
      console.log(`  - ${r.column_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    await pool.end();
  }
}

dropOldColumns();
