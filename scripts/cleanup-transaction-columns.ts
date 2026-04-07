/**
 * Cleanup script: Remove old delivery columns from transactions table
 * These columns were moved to the separate deliveries table
 * 
 * Run: npx ts-node scripts/cleanup-transaction-columns.ts
 */

import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function cleanupTransactionColumns() {
  try {
    console.log('[Cleanup] Starting transaction table cleanup...');

    // Drop old delivery columns from transactions
    const columnsToRemove = [
      'delivery_status',
      'delivery_notes',
      'delivered_at',
      'receipt_confirmed_at',
      'delivery_updated_at',
    ];

    for (const column of columnsToRemove) {
      try {
        await db.execute(sql.raw(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "${column}"`));
        console.log(`[Cleanup] ✓ Dropped column: ${column}`);
      } catch (e) {
        console.warn(`[Cleanup] ⚠ Could not drop ${column}:`, e instanceof Error ? e.message : e);
      }
    }

    console.log('[Cleanup] ✓ Transaction table cleanup complete!');
    console.log('[Cleanup] Transactions table now only has:');
    console.log('  - Transaction fields (id, bike_id, buyer_id, seller_id, amount, status, etc.)');
    console.log('  - delivery_id FK to deliveries table');
    console.log('  - Standard timestamps (created_at, updated_at)');
    console.log('[Success] You can now start the backend: npm run dev');

    process.exit(0);
  } catch (e) {
    console.error('[Error] Cleanup failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

cleanupTransactionColumns();
