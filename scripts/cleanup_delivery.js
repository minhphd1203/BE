const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('🔄 Running cleanup migrations...');
    
    // 0019: Drop old delivery columns
    console.log('\n1️⃣ Dropping old delivery columns from transactions...');
    const cols = ['delivery_status', 'delivery_notes', 'delivered_at', 'receipt_confirmed_at', 'delivery_updated_at'];
    for (const col of cols) {
      try {
        await pool.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "${col}" CASCADE`);
        console.log(`  ✓ Dropped: ${col}`);
      } catch (e) {
        console.log(`  ⚠️ Error or already dropped: ${col}`);
      }
    }

    // 0020: Add delivery_id FK if not exists
    console.log('\n2️⃣ Adding delivery_id FK to transactions...');
    try {
      await pool.query(`ALTER TABLE "transactions" ADD COLUMN "delivery_id" uuid REFERENCES "deliveries"("id")`);
      console.log('  ✓ Added delivery_id FK');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ✓ delivery_id FK already exists');
      } else {
        console.log('  ⚠️ ' + e.message);
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log('\n🔍 Final transactions table columns:');
    const result = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`);
    result.rows.forEach(r => console.log('  - ' + r.column_name));
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    pool.end();
  }
})();
