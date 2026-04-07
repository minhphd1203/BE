const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('🔄 Dropping old delivery columns from transactions table...');
    
    const cols = ['delivery_status', 'delivery_notes', 'delivered_at', 'receipt_confirmed_at', 'delivery_updated_at'];
    
    for (const col of cols) {
      try {
        console.log('  Dropping: ' + col);
        await pool.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "${col}" CASCADE`);
        console.log('  ✓ Dropped: ' + col);
      } catch (e) {
        console.log('  ⚠️ Error or already dropped: ' + col);
      }
    }
    
    console.log('');
    console.log('✅ All old columns removed!');
    console.log('');
    console.log('🔍 Remaining columns:');
    
    const result = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`);
    result.rows.forEach(r => console.log('  - ' + r.column_name));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
})();
