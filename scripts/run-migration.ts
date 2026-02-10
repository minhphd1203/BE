import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

async function runMigrations() {
  try {
    console.log('Running migrations...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../drizzle/0000_smiling_goblin_queen.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by statement-breakpoint and execute each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      await sql.unsafe(statement);
      console.log('✓ Executed statement');
    }
    
    console.log('✓ All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    await sql.end();
  }
}

runMigrations();
