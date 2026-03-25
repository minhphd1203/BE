import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { client } from '../src/db';

dotenv.config();

async function runMigration() {
  try {
    // Read and execute the migration SQL
    const sqlFile = path.join(__dirname, '../drizzle/0006_add_report_reasons.sql');
    const migrationSql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('Running migration 0006_add_report_reasons.sql...');
    
    // Execute raw SQL using the postgres client's unsafe method
    await client.unsafe(migrationSql);
    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
