import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    console.log('📄 Reading SQL file...');
    const sqlPath = path.join(__dirname, 'add-inspector-columns.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing migration...');
    
    // Split SQL by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        await sql.unsafe(statement);
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

runMigration();
