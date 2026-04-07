/**
 * Database verification script
 * Checks what tables exist in Neon vs what the schema expects
 * 
 * Run: npx ts-node scripts/verify-db-schema.ts
 */

import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function verifyDatabase() {
  try {
    console.log('[Verify] Starting database schema verification...\n');

    // Get all tables in database
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('[Tables] Found in database:');
    const tableNames: string[] = [];
    for (const row of tables) {
      const name = (row as any).table_name;
      tableNames.push(name);
      console.log(`  - ${name}`);
    }

    // Check critical tables for payout system
    const criticalTables = ['deliveries', 'payouts', 'transactions'];
    console.log('\n[Critical] Checking payout system tables:');
    for (const table of criticalTables) {
      const exists = tableNames.includes(table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    }

    // Check transactions table columns
    console.log('\n[Columns] Checking transactions table columns:');
    const txnColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      ORDER BY column_name
    `);

    const columnNames: string[] = [];
    for (const col of txnColumns) {
      columnNames.push((col as any).column_name);
    }
    console.log('  Found columns:', columnNames.length);
    
    // Check for old delivery columns that shouldn't exist
    const oldCols = ['delivery_status', 'delivery_notes', 'delivered_at', 'receipt_confirmed_at', 'delivery_updated_at'];
    const foundOldCols = oldCols.filter(col => columnNames.includes(col));
    if (foundOldCols.length > 0) {
      console.log('  ⚠ OLD COLUMNS FOUND (should be removed):');
      foundOldCols.forEach(col => console.log(`    - ${col}`));
    } else {
      console.log('  ✓ No old delivery columns');
    }

    // Check for required new column
    if (columnNames.includes('delivery_id')) {
      console.log('  ✓ delivery_id FK exists');
    } else {
      console.log('  ✗ delivery_id FK MISSING');
    }

    // Check deliveries table columns
    console.log('\n[Columns] Checking deliveries table columns:');
    if (tableNames.includes('deliveries')) {
      const deliveryColumns = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'deliveries'
        ORDER BY column_name
      `);
      const delCols: string[] = [];
      for (const col of deliveryColumns) {
        delCols.push((col as any).column_name);
      }
      console.log('  Found columns:', delCols.length);
      console.log('  Columns:', delCols.join(', '));
    } else {
      console.log('  ✗ deliveries table does NOT exist');
    }

    // Check payouts table columns
    console.log('\n[Columns] Checking payouts table columns:');
    if (tableNames.includes('payouts')) {
      const payoutColumns = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'payouts'
        ORDER BY column_name
      `);
      const payoutCols: string[] = [];
      for (const col of payoutColumns) {
        payoutCols.push((col as any).column_name);
      }
      console.log('  Found columns:', payoutCols.length);
      console.log('  Columns:', payoutCols.join(', '));
    } else {
      console.log('  ✗ payouts table does NOT exist');
    }

    console.log('\n[Summary] Database verification complete');
    process.exit(0);
  } catch (e) {
    console.error('[Error] Verification failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

verifyDatabase();
